// SPDX-License-Identifier: GPL-3.0-or-later
//! One file session per process, communicating only over stdin/stdout.
use npzsee::service::{Service, decode_request};
use serde_json::json;
use std::{
    io::{self, BufRead, Read, Write},
    path::PathBuf,
    sync::{
        Arc, Mutex,
        atomic::{AtomicU64, Ordering},
        mpsc,
    },
};

fn main() {
    let mut args = std::env::args().skip(1);
    let Some(file) = args.next() else {
        eprintln!("usage: npzsee-backend FILE");
        std::process::exit(2);
    };
    if file == "--version" {
        println!("npzsee-backend {} protocol 1", env!("CARGO_PKG_VERSION"));
        return;
    }
    let file = PathBuf::from(file);
    let generation = Arc::new(AtomicU64::new(0));
    let stdout = Arc::new(Mutex::new(io::stdout()));
    let (tx, rx) = mpsc::channel::<(u64, npzsee::service::Request)>();
    let gen_worker = generation.clone();
    let out_worker = stdout.clone();
    let worker = std::thread::spawn(move || {
        let mut service = Service::new(&file);
        while let Ok((ticket, request)) = rx.recv() {
            let result = if gen_worker.load(Ordering::Relaxed) != ticket {
                Err(anyhow::anyhow!("任务已取消"))
            } else {
                match &mut service {
                    Ok(service) => {
                        service.handle(&request.method, request.params, &gen_worker, ticket)
                    }
                    Err(error) => Err(anyhow::anyhow!("{error:#}")),
                }
            };
            let response = match result {
                Ok(result) => json!({"id":request.id,"result":result}),
                Err(error) => {
                    let message = format!("{error:#}");
                    json!({"id":request.id,"error":message,"code":error_code(&message)})
                }
            };
            let mut out = out_worker.lock().unwrap();
            if writeln!(out, "{response}")
                .and_then(|_| out.flush())
                .is_err()
            {
                break;
            }
        }
    });
    let mut input = io::stdin().lock();
    loop {
        let mut line = String::new();
        match input.by_ref().take(65538).read_line(&mut line) {
            Ok(0) | Err(_) => break,
            Ok(_) => {}
        }
        if line.len() > 65536 {
            break;
        }
        let response = match decode_request(&line) {
            Ok(request) if request.method == "cancel" => {
                generation.fetch_add(1, Ordering::Relaxed);
                Some(json!({"id":request.id,"result":{"cancelled":true}}))
            }
            Ok(request) => {
                if tx
                    .send((generation.load(Ordering::Relaxed), request))
                    .is_err()
                {
                    break;
                }
                None
            }
            Err(error) => {
                let id = serde_json::from_str::<serde_json::Value>(&line)
                    .ok()
                    .and_then(|v| v.get("id").and_then(|i| i.as_u64()));
                Some(json!({"id":id,"error":format!("{error:#}"),"code":"RANGE"}))
            }
        };
        if let Some(response) = response {
            let mut out = stdout.lock().unwrap();
            if writeln!(out, "{response}")
                .and_then(|_| out.flush())
                .is_err()
            {
                break;
            }
        }
    }
    generation.fetch_add(1, Ordering::Relaxed);
    drop(tx);
    let _ = worker.join();
}

fn error_code(message: &str) -> &'static str {
    if message.contains("pickle") {
        "OBJECT"
    } else if message.contains("取消") {
        "CANCELLED"
    } else if message.contains("临时") || message.contains("无法打开") {
        "IO"
    } else if message.contains("空数组") {
        "EMPTY"
    } else if message.contains("有限数值") {
        "NONFINITE"
    } else if message.contains("一维或二维") {
        "SLICE"
    } else if message.contains("字符串") || message.contains("数据类型无法") {
        "NUMERIC"
    } else if ["NPY", "NPZ", "header", "CRC", "Zip", "zip", "文件过短"]
        .iter()
        .any(|part| message.contains(part))
    {
        "INVALID_FILE"
    } else {
        "RANGE"
    }
}
