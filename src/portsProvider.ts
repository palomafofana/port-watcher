import * as vscode from 'vscode';
import { getActivePorts, killProcess, PortInfo } from './portDetector';

export class PortItem extends vscode.TreeItem {
  constructor(
    public readonly portInfo: PortInfo
  ) {
    super(`Port ${portInfo.port}`, vscode.TreeItemCollapsibleState.None);
    this.tooltip = `${portInfo.process} (PID: ${portInfo.pid})`;
    this.description = `${portInfo.process} (PID: ${portInfo.pid})`;
    this.contextValue = 'portItem';
    // Command so clicking the item triggers the kill flow
    this.command = {
      command: 'port-watcher.killPort',
      title: 'Kill port',
      arguments: [portInfo]
    };
  }
}

export class PortsProvider implements vscode.TreeDataProvider<PortItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<PortItem | undefined | void> =
    new vscode.EventEmitter<PortItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<PortItem | undefined | void> =
    this._onDidChangeTreeData.event;

  private ports: PortInfo[] = [];

  constructor() {}

  refresh(): Thenable<void> {
    return this.load().then(() => this._onDidChangeTreeData.fire());
  }

  async load(): Promise<void> {
    try {
      this.ports = await getActivePorts();
    } catch (err) {
      this.ports = [];
      console.error('Failed to load ports:', err);
    }
  }

  getTreeItem(element: PortItem): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<PortItem[]> {
    // If not loaded yet, load once
    if (!this.ports || this.ports.length === 0) {
      await this.load();
    }
    // Map to TreeItems
    return this.ports.map(p => new PortItem(p));
  }

  // Utility: remove a port from view after kill (UI update)
  removePort(pid: number) {
    this.ports = this.ports.filter(p => p.pid !== pid);
    this._onDidChangeTreeData.fire();
  }
}