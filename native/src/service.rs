// SPDX-License-Identifier: GPL-3.0-or-later
//! Headless, bounded-data API. Parsing, slicing and analysis stay in Rust.
use crate::{
    analysis::{Envelope, Histogram, Layout, Series},
    data::{Array, Catalog, Component},
};
use anyhow::{Context, Result, bail, ensure};
use serde::Deserialize;
use serde_json::{Value, json};
use std::{
    collections::VecDeque,
    path::Path,
    sync::{Arc, atomic::AtomicU64},
    time::Instant,
};

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(default, rename_all = "camelCase", deny_unknown_fields)]
pub struct Params {
    pub array: usize,
    pub prefix: Vec<usize>,
    pub start: usize,
    pub count: Option<usize>,
    pub column_start: usize,
    pub column_count: Option<usize>,
    pub component: String,
    pub layout: String,
    pub row: usize,
    pub range: Option<[f64; 2]>,
    pub columns: Option<usize>,
    pub bins: Option<usize>,
    pub exact: bool,
    pub index: usize,
    pub indices: Vec<usize>,
}

pub struct Service {
    catalog: Catalog,
    cache: VecDeque<(usize, Arc<Array>)>,
    envelope: Option<(String, Envelope)>,
}

impl Service {
    pub fn new(path: &Path) -> Result<Self> {
        Ok(Self {
            catalog: Catalog::open(path)?,
            cache: VecDeque::new(),
            envelope: None,
        })
    }

    fn array(
        &mut self,
        index: usize,
        generation: &AtomicU64,
        ticket: u64,
    ) -> Result<(Arc<Array>, bool)> {
        if let Some(pos) = self.cache.iter().position(|(i, _)| *i == index) {
            let item = self.cache.remove(pos).unwrap();
            let array = item.1.clone();
            self.cache.push_back(item);
            return Ok((array, true));
        }
        let array = Arc::new(Array::load(
            &self.catalog,
            index,
            generation,
            ticket,
            |_, _| {},
        )?);
        self.cache.push_back((index, array.clone()));
        while self.cache.len() > 2
            || (self.cache.len() > 1
                && self
                    .cache
                    .iter()
                    .map(|(_, a)| a.header.nbytes as u64)
                    .sum::<u64>()
                    > 512 * 1024 * 1024)
        {
            self.cache.pop_front();
        }
        Ok((array, false))
    }

    pub fn handle(
        &mut self,
        method: &str,
        p: Params,
        generation: &AtomicU64,
        ticket: u64,
    ) -> Result<Value> {
        let start = Instant::now();
        if method == "open" || method == "reload" {
            if method == "reload" {
                self.envelope = None;
                self.cache.clear();
                self.catalog = Catalog::open(&self.catalog.path)?;
            }
            return Ok(
                json!({"entries":self.catalog.entries.iter().enumerate().map(|(i, e)| json!({"index":i,"name":e.name,"bytes":e.bytes,"compressedBytes":e.compressed_bytes})).collect::<Vec<_>>(), "protocol":1}),
            );
        }
        ensure!(
            matches!(
                method,
                "select" | "table" | "cell" | "plot" | "histogram" | "sample"
            ),
            "未知请求: {method}"
        );
        let (array, cached) = self.array(p.array, generation, ticket)?;
        let h = &array.header;
        ensure!(
            p.prefix.len() <= h.shape.len() && p.prefix.iter().zip(&h.shape).all(|(i, n)| i < n),
            "切片索引越界"
        );
        let shape = &h.shape[p.prefix.len()..];
        let component = match p.component.as_str() {
            "" | "real" => Component::Real,
            "imag" => Component::Imag,
            "magnitude" => Component::Magnitude,
            "phase" => Component::Phase,
            _ => bail!("未知复数分量"),
        };
        let mut result = match method {
            "select" => {
                // Release the old series when switching arrays, including its map.
                if self
                    .envelope
                    .as_ref()
                    .is_some_and(|(_, e)| !Arc::ptr_eq(&e.series.array, &array))
                {
                    self.envelope = None;
                }
                json!({"name":array.name,"shape":h.shape,"dtype":h.dtype.label,"kind":h.dtype.kind.to_string(),"numeric":h.dtype.numeric(),"text":h.dtype.text(),"count":h.count,"bytes":h.nbytes,"fortran":h.fortran,"cached":cached})
            }
            "table" => {
                if shape.is_empty() {
                    let value = array.display(&p.prefix);
                    let (value, truncated) = preview(&value, 2_000_000);
                    json!({"kind":"scalar","shape":shape,"value":value,"truncated":truncated})
                } else if shape.contains(&0) {
                    json!({"kind":"empty","shape":shape,"rows":[],"totalRows":shape[0],"totalColumns":if shape.len()==2 {shape[1]} else {1}})
                } else {
                    let total_rows = shape[0];
                    let total_columns = if shape.len() == 2 { shape[1] } else { 1 };
                    ensure!(
                        p.start <= total_rows && p.column_start < total_columns,
                        "表格范围越界"
                    );
                    let end = p
                        .start
                        .saturating_add(p.count.unwrap_or(100).clamp(1, 200))
                        .min(total_rows);
                    let col_end = p
                        .column_start
                        .saturating_add(p.column_count.unwrap_or(8).clamp(1, 16))
                        .min(total_columns);
                    let mut rows = Vec::new();
                    for i in p.start..end {
                        let mut values = Vec::new();
                        for col in p.column_start..col_end {
                            if shape.len() > 2 {
                                values.push(format!("shape {:?} →", &shape[1..]));
                            } else {
                                let mut indices = p.prefix.clone();
                                indices.push(i);
                                if shape.len() == 2 {
                                    indices.push(col);
                                }
                                values.push(preview(&array.display(&indices), 240).0);
                            }
                        }
                        rows.push(json!({"index":i,"values":values}));
                    }
                    json!({"kind":if shape.len()>2 {"nested"} else if shape.len()==2 {"matrix"} else {"vector"},"shape":shape,"start":p.start,"columnStart":p.column_start,"totalRows":total_rows,"totalColumns":total_columns,"rows":rows})
                }
            }
            "cell" => {
                ensure!(array.offset_of(&p.indices).is_some(), "单元格索引越界");
                let value = array.display(&p.indices);
                let (value, truncated) = preview(&value, 2_000_000);
                json!({"value":value,"truncated":truncated})
            }
            "plot" | "sample" => {
                ensure!(
                    h.dtype.numeric(),
                    "字符串或此数据类型无法绘图，请使用 Table 查看。"
                );
                ensure!(shape.len() <= 2, "请先在 Table 中进入一维或二维切片。");
                ensure!(!shape.contains(&0), "空数组无法绘图。");
                let layout = match p.layout.as_str() {
                    "" | "row" => Layout::Row,
                    "xyRows" => {
                        ensure!(matches!(shape, [2, _]), "X/Y 行模式要求 shape 为 (2, N)");
                        Layout::XyRows
                    }
                    "xyColumns" => {
                        ensure!(matches!(shape, [_, 2]), "X/Y 列模式要求 shape 为 (N, 2)");
                        Layout::XyColumns
                    }
                    _ => bail!("未知绘图模式"),
                };
                if layout == Layout::Row && shape.len() == 2 {
                    ensure!(p.row < shape[0], "绘图行越界");
                }
                let series = Series::new(array.clone(), p.prefix.clone(), component, layout, p.row);
                if method == "sample" {
                    ensure!(p.index < series.len, "采样点索引越界");
                    let point = series.point(p.index);
                    let value = match layout {
                        Layout::Row => {
                            let mut indices = series.prefix.clone();
                            if !shape.is_empty() {
                                indices.push(p.index);
                            }
                            array.display(&indices)
                        }
                        _ => format!("X = {}, Y = {}", point[0], point[1]),
                    };
                    json!({"index":p.index,"point":point,"value":value})
                } else {
                    let key = format!(
                        "{}:{:?}:{:?}:{:?}:{}",
                        p.array, p.prefix, component, layout, p.row
                    );
                    if self.envelope.as_ref().is_none_or(|(k, _)| k != &key) {
                        self.envelope = Some((key, Envelope::build(series, generation, ticket)?));
                    }
                    let envelope = &self.envelope.as_ref().unwrap().1;
                    ensure!(envelope.finite > 0, "没有可绘制的有限数值。");
                    let range = p.range.unwrap_or(envelope.x_range);
                    ensure!(
                        range.iter().all(|v| v.is_finite()) && range[0] <= range[1],
                        "无效绘图范围"
                    );
                    json!({"points":envelope.points(range, p.columns.unwrap_or(1000)),"xRange":envelope.x_range,"yRange":envelope.y_range,"length":envelope.series.len,"finite":envelope.finite,"layout":p.layout})
                }
            }
            "histogram" => {
                let hist = Histogram::build(
                    &array,
                    &p.prefix,
                    component,
                    p.bins.unwrap_or(64),
                    p.exact,
                    generation,
                    ticket,
                )?;
                json!({"points":hist.points(),"counts":hist.counts,"range":if hist.count>0 {hist.range} else {[0.,1.]},"dataRange":hist.data_range,"count":hist.count,"sampled":hist.sampled,"total":hist.total,"nonfinite":hist.nonfinite,"mean":hist.mean,"std":hist.std,"exact":p.exact})
            }
            _ => unreachable!(),
        };
        result["elapsedMs"] = json!(start.elapsed().as_secs_f64() * 1000.);
        Ok(result)
    }
}

fn preview(value: &str, limit: usize) -> (String, bool) {
    let mut chars = value.chars();
    let mut result: String = chars.by_ref().take(limit).collect();
    let truncated = chars.next().is_some();
    if truncated {
        result.push('…');
    }
    (result, truncated)
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Request {
    pub id: u64,
    pub method: String,
    #[serde(default)]
    pub params: Params,
}

pub fn decode_request(line: &str) -> Result<Request> {
    ensure!(line.len() <= 64 * 1024, "请求过大");
    serde_json::from_str(line).context("请求格式无效")
}
