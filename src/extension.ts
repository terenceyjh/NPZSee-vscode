// SPDX-License-Identifier: GPL-3.0-or-later
// Direction: independent VS Code project, preserving Rust for all data work.
import * as vscode from 'vscode';
import * as path from 'node:path';
import { randomBytes } from 'node:crypto';
import { Backend } from './backend';
import { languages, resolveLanguage, translate, type Language } from './i18n';

function language(): Language {
  const setting=vscode.workspace.getConfiguration('npzsee').get<string>('language','auto');
  return resolveLanguage(setting==='auto'?vscode.env.language:setting);
}

const methods = new Set(['open', 'reload', 'select', 'table', 'cell', 'plot', 'sample', 'histogram', 'cancel']);

class Document implements vscode.CustomDocument {
  readonly panels = new Set<vscode.WebviewPanel>();
  private backend?: Backend;
  private readonly watcher: vscode.FileSystemWatcher;
  private readonly disposables: vscode.Disposable[] = [];
  private disposed = false;
  constructor(readonly uri: vscode.Uri, private readonly executable: string, private readonly onDispose: () => void) {
    this.watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(vscode.Uri.joinPath(uri, '..'), path.basename(uri.path)));
    const changed = () => {
      this.backend?.dispose();
      this.backend = undefined;
      this.broadcast({ type: 'changed' });
    };
    this.disposables.push(this.watcher.onDidChange(changed), this.watcher.onDidDelete(changed), this.watcher.onDidCreate(changed));
  }
  request(method: string, params: unknown): Promise<any> {
    if (this.disposed) return Promise.reject(new Error('File is closed.'));
    if (!this.backend?.alive) {
      this.backend = new Backend(this.executable, this.uri.fsPath, message => this.broadcast({ type: 'backendError', message }));
    }
    return this.backend.request(method, params);
  }
  broadcast(message: unknown): void { for (const panel of this.panels) void panel.webview.postMessage(message); }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.backend?.dispose();
    this.backend = undefined;
    this.watcher.dispose();
    this.disposables.forEach(d => d.dispose());
    this.panels.clear();
    this.onDispose();
  }
}

class Provider implements vscode.CustomReadonlyEditorProvider<Document>, vscode.Disposable {
  readonly documents = new Map<string, Document>();
  private active?: Document;
  constructor(private readonly context: vscode.ExtensionContext) {}
  openCustomDocument(uri: vscode.Uri): Document {
    if (!['file', 'vscode-remote'].includes(uri.scheme)) throw new Error(translate(language(),'This viewer needs a file on a local or remote disk.'));
    const executable = vscode.Uri.joinPath(this.context.extensionUri, 'bin', `${process.platform}-${process.arch}`, `npzsee-backend${process.platform === 'win32' ? '.exe' : ''}`).fsPath;
    const document = new Document(uri, executable, () => {
      this.documents.delete(uri.toString());
      if (this.active === document) this.active = undefined;
    });
    this.documents.set(uri.toString(), document);
    return document;
  }
  resolveCustomEditor(document: Document, panel: vscode.WebviewPanel): void {
    document.panels.add(panel);
    this.active = document;
    panel.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'out', 'media')] };
    const resource = (file: string) => panel.webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'out', 'media', file));
    const nonce = randomBytes(18).toString('base64');
    panel.webview.html = `<!DOCTYPE html><html lang="${language()}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${panel.webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${panel.webview.cspSource} data:;"><link href="${resource('style.css')}" rel="stylesheet"><title>NPZSee</title></head><body><div id="app"></div><script nonce="${nonce}">window.NPZSEE_BOOTSTRAP=${JSON.stringify({language:language()})};</script><script nonce="${nonce}" src="${resource('main.js')}"></script></body></html>`;
    const listeners = [
      panel.onDidChangeViewState(e => { if (e.webviewPanel.active) this.active = document; }),
      panel.webview.onDidReceiveMessage(async message => {
        if (!message || typeof message !== 'object') return;
        if (message.type === 'request' && Number.isSafeInteger(message.id) && methods.has(message.method)) {
          try {
            const result = await document.request(message.method, message.params ?? {});
            if(message.method==='open'||message.method==='reload') result.language=language();
            await panel.webview.postMessage({ type: 'response', id: message.id, result });
          } catch (error) {
            await panel.webview.postMessage({ type: 'response', id: message.id, error: error instanceof Error ? error.message : String(error), code: (error as {code?:string})?.code??'BACKEND' });
          }
        } else if(message.type==='setLanguage'&&languages.some(item=>item.value===message.language)) {
          await vscode.workspace.getConfiguration('npzsee').update('language',message.language,vscode.ConfigurationTarget.Global);
        } else if (message.type === 'copy' && typeof message.text === 'string' && message.text.length <= 4_000_000) {
          await vscode.env.clipboard.writeText(message.text);
        } else if (message.type === 'export' && typeof message.svg === 'string' && message.svg.length < 8_000_000) {
          try {
            const uri = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.joinPath(document.uri, '..', `${path.basename(document.uri.path)}.svg`), filters: { SVG: ['svg'] } });
            if (uri) {
              await vscode.workspace.fs.writeFile(uri, Buffer.from(message.svg, 'utf8'));
              void vscode.window.showInformationMessage(`NPZSee: ${translate(language(),'SVG exported.')}`);
            }
          } catch (error) { void vscode.window.showErrorMessage(`NPZSee: ${translate(language(),'Export failed.')} ${error}`); }
        }
      }),
    ];
    panel.onDidDispose(() => { document.panels.delete(panel); listeners.forEach(d => d.dispose()); });
  }
  reload(): void { this.active?.broadcast({ type: 'reload' }); }
  updateLanguage(): void {for(const document of this.documents.values())document.broadcast({type:'language',language:language()});}
  dispose(): void { for (const document of this.documents.values()) document.dispose(); }
}

export function activate(context: vscode.ExtensionContext) {
  const provider = new Provider(context);
  context.subscriptions.push(provider,
    vscode.window.registerCustomEditorProvider('npzsee.viewer', provider, { supportsMultipleEditorsPerDocument: false }),
    vscode.commands.registerCommand('npzsee.open', async (uri?: vscode.Uri) => {
      if (!(uri instanceof vscode.Uri)) uri = (await vscode.window.showOpenDialog({ canSelectMany: false, filters: { NumPy: ['npy', 'npz'] } }))?.[0];
      if (uri) await vscode.commands.executeCommand('vscode.openWith', uri, 'npzsee.viewer');
    }),
    vscode.commands.registerCommand('npzsee.reload', () => provider.reload()),
    vscode.workspace.onDidChangeConfiguration(event=>{if(event.affectsConfiguration('npzsee.language'))provider.updateLanguage();}),
  );
  return { getSessionCount: () => provider.documents.size };
}
