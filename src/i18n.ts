// SPDX-License-Identifier: GPL-3.0-or-later
import messages from '../locales/messages.json';
export type Language = 'zh-CN' | 'en' | 'fr' | 'es' | 'ru' | 'ar';
export const languages: { value: Language; label: string }[] = [
  {value:'zh-CN',label:'简体中文'}, {value:'en',label:'English'}, {value:'fr',label:'Français'},
  {value:'es',label:'Español'}, {value:'ru',label:'Русский'}, {value:'ar',label:'العربية'},
];
const columns: Record<Exclude<Language,'en'>,number> = {'zh-CN':0,fr:1,es:2,ru:3,ar:4};
let current: Language = 'en';
export function resolveLanguage(value: string | undefined): Language {
  const code=(value??'en').toLowerCase();
  if(code.startsWith('zh')) return 'zh-CN';
  const base=code.split('-')[0];
  return ['fr','es','ru','ar'].includes(base)?base as Language:'en';
}
export function setLanguage(language: Language) {current=language;}
export function getLanguage(): Language {return current;}
export function translate(language: Language,key: string,values: Record<string,string|number> = {}): string {
  const row=(messages as Record<string,string[]>)[key];
  const value=language==='en'||!row?key:row[columns[language]];
  return value.replace(/\{(\w+)\}/g,(match,key)=>Object.hasOwn(values,key)?String(values[key]):match);
}
export function t(key: string,values?: Record<string,string|number>): string {return translate(current,key,values);}
export function formatNumber(value: number,options?: Intl.NumberFormatOptions) {return new Intl.NumberFormat(current,options).format(value);}
