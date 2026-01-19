import * as vscode from 'vscode';
import { PortsProvider } from './portsProvider';
import { killProcess } from './portDetector';

export function activate(context: vscode.ExtensionContext) {
  console.log('Port Watcher activated');

  const provider = new PortsProvider();

  // Register the TreeDataProvider under the view id 'portWatcher.ports'
  const treeView = vscode.window.createTreeView('portWatcher.ports', {
    treeDataProvider: provider,
    showCollapseAll: false
  });

  // Refresh command
  const refreshCmd = vscode.commands.registerCommand('port-watcher.refresh', async () => {
    await provider.refresh();
    vscode.window.showInformationMessage('Ports refreshed');
  });

  // Kill command used by clicking the tree item (or invoked programmatically)
  const killCmd = vscode.commands.registerCommand('port-watcher.killPort', async (portInfo: any) => {
    if (!portInfo) {
      return;
    }
    const confirm = await vscode.window.showWarningMessage(
      `Kill process ${portInfo.process} (PID: ${portInfo.pid}) on port ${portInfo.port}?`,
      { modal: true },
      'Kill'
    );
    if (confirm === 'Kill') {
      const ok = await killProcess(portInfo.pid);
      if (ok) {
        vscode.window.showInformationMessage(`Killed process on port ${portInfo.port}`);
        provider.removePort(portInfo.pid);
      } else {
        vscode.window.showErrorMessage(`Failed to kill process ${portInfo.pid}`);
      }
    }
  });

  // Optional: QuickPick command (keeps the lightweight dropdown UI available in addition to the sidebar)
  // This is useful if you like the ephemeral QuickPick UI you had earlier.
  const quickPickCmd = vscode.commands.registerCommand('port-watcher.showPorts', async () => {
  await provider.refresh();
  const children = await provider.getChildren();

  // Ensure description is string|undefined and keep portInfo on the item
  const items: (vscode.QuickPickItem & { portInfo: any })[] = children.map(item => ({
    label: item.label as string,
    description: typeof item.description === 'string' ? item.description : undefined,
    portInfo: (item as any).portInfo
  }));

  // showQuickPick expects QuickPickItem[] so cast the extended items
  const selected = await vscode.window.showQuickPick(items as vscode.QuickPickItem[], {
    placeHolder: 'Select a port to kill its process'
  });

  if (selected) {
    // cast back to extended type to access portInfo
    await vscode.commands.executeCommand('port-watcher.killPort', (selected as any).portInfo);
  }
});

  // Clean up disposables when the extension is deactivated
  context.subscriptions.push(refreshCmd, killCmd, treeView);
}

export function deactivate() {}