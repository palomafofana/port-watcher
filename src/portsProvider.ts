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
  private autoRefreshTimer: NodeJS.Timeout | undefined;
  private autoRefreshMs = 5000;
  private autoRefreshEnabled = false;

  constructor() {}

  refresh(): Thenable<void> {
    return this.load().then(() => this._onDidChangeTreeData.fire());
  }

  async load(): Promise<void> {
    try {
      this.ports = await getActivePorts();
      if (this.ports.length === 0) {
        const choice = await vscode.window.showInformationMessage(
          'No listening ports found. Ensure lsof/netstat are available.',
          'Refresh',
          'View lsof help'
        );
        if (choice === 'Refresh') {
          await this.refresh();
        } else if (choice === 'View lsof help') {
          vscode.env.openExternal(vscode.Uri.parse('https://man7.org/linux/man-pages/man8/lsof.8.html'));
        }
      }
    } catch (err) {
      this.ports = [];
      console.error('Failed to load ports:', err);
    }
  }

  getTreeItem(element: PortItem): vscode.TreeItem {
    element.iconPath = new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('charts.green'));
    element.description = `${element.portInfo.process} (PID: ${element.portInfo.pid})`;
    element.tooltip = `Port: ${element.portInfo.port}\nProcess: ${element.portInfo.process}\nPID: ${element.portInfo.pid}\nClick to kill`;
    element.command = {
      command: 'port-watcher.killPort',
      title: 'Kill Process',
      arguments: [element.portInfo]
    };

    return element;
  }

  async getChildren(): Promise<PortItem[]> {
    // If not loaded yet, load once
    if (!this.ports || this.ports.length === 0) {
      await this.load();
    }
    return this.ports.map(p => new PortItem(p));
  }

  toggleAutoRefresh() {
    if (this.autoRefreshEnabled) {
      if (this.autoRefreshTimer) {
        clearInterval(this.autoRefreshTimer);
        this.autoRefreshTimer = undefined;
      }
      this.autoRefreshEnabled = false;
      vscode.window.showInformationMessage('Auto-refresh stopped');
      return;
    }

    this.autoRefreshEnabled = true;
    this.autoRefreshTimer = setInterval(() => {
      this.refresh();
    }, this.autoRefreshMs);
    vscode.window.showInformationMessage(`Auto-refresh started (every ${this.autoRefreshMs / 1000}s)`);
  }

  // Utility: remove a port from view after kill (UI update)
  removePort(pid: number) {
    this.ports = this.ports.filter(p => p.pid !== pid);
    this._onDidChangeTreeData.fire();
  }
}