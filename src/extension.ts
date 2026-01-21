import * as vscode from 'vscode';
import { PortsProvider } from './portsProvider';
import { killProcess } from './portDetector';

export function activate(context: vscode.ExtensionContext) {
  console.log('Port Watcher activated');

  const provider = new PortsProvider();

  const treeView = vscode.window.createTreeView('portWatcher.ports', {
    treeDataProvider: provider,
    showCollapseAll: false
  });

  // Refresh command
  const refreshCmd = vscode.commands.registerCommand('port-watcher.refresh', async () => {
    await provider.refresh();
    vscode.window.showInformationMessage('Ports refreshed');
  });

  // Kill command used by clicking the tree item 
  const killCmd = vscode.commands.registerCommand('port-watcher.killPort', async (portInfo: any) => {
    if (!portInfo) {
      return;
    }
    const isWindows = process.platform === 'win32';
    const buttons = isWindows ? ['Terminate', 'Terminate /F'] : ['Kill gracefully', 'Force kill'];

    const confirm = await vscode.window.showWarningMessage(
      `${isWindows ? 'Terminate' : 'Kill'} process ${portInfo.process} (PID: ${portInfo.pid}) on port ${portInfo.port}?`,
      { modal: true },
      ...buttons
    );

    if (!confirm) {
      return;
    }

    const force = isWindows ? confirm === 'Terminate /F' : confirm === 'Force kill';
    const ok = await killProcess(portInfo.pid, force ? 'force' : 'graceful');
    if (ok) {
      vscode.window.showInformationMessage(`${force ? 'Force' : 'Graceful'} kill sent for port ${portInfo.port}`);
      provider.removePort(portInfo.pid);
    } else {
      vscode.window.showErrorMessage(`Failed to ${force ? 'force-kill' : 'terminate'} process ${portInfo.pid}`);
    }
  });

  const quickPickCmd = vscode.commands.registerCommand('port-watcher.showPorts', async () => {
    await provider.refresh();
    const children = await provider.getChildren();

    const items: (vscode.QuickPickItem & { portInfo: any })[] = children.map(item => ({
      label: item.label as string,
      description: typeof item.description === 'string' ? item.description : undefined,
      portInfo: (item as any).portInfo
    }));

    const selected = await vscode.window.showQuickPick(items as vscode.QuickPickItem[], {
      placeHolder: 'Select a port to kill its process'
    });

    if (selected) {
      await vscode.commands.executeCommand('port-watcher.killPort', (selected as any).portInfo);
    }
  });

  const toggleAutoRefreshCmd = vscode.commands.registerCommand('port-watcher.toggleAutoRefresh', () => {
    provider.toggleAutoRefresh();
  });

  // Clean up disposables when the extension is deactivated
  context.subscriptions.push(refreshCmd, killCmd, quickPickCmd, toggleAutoRefreshCmd, treeView);
}

export function deactivate() {}