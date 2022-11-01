import * as vscode from 'vscode'
import * as pathModule from 'path'
import {
  getInterpreterDetails,
  initializePython,
  onDidChangePythonInterpreter,
} from './common/python'
import {
  LanguageClient,
  LanguageClientOptions,
  RevealOutputChannelOn,
  ServerOptions,
} from 'vscode-languageclient/node'
import { Uri } from 'vscode'

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

function getCommandLineArguments(): string[] {
  const contractKind = vscode.workspace
    .getConfiguration('crosshair-vscode')
    .get('contract_kind')
  const args = []
  if (contractKind !== 'default (PEP316, deal, or icontract)') {
    args.push(`--analysis_kind=${contractKind}`)
  }
  return args
}

async function inferPythonPath(
  document?: vscode.TextDocument
): Promise<string> {
  const interpreter = await getInterpreterDetails()
  if (interpreter.path !== undefined) {
    return interpreter.path[0]
  }
  return 'python'
}

/**
 * Execute the command in a terminal.
 *
 * The terminals related to this extension are all expected to have the same name.
 * If a terminal exists with this name, it will first be closed and a new terminal
 * will be created.
 *
 * @param name of the terminal
 * @param command to be executed
 */
function executeInRestartedTerminal(name: string, command: string): void {
  // Close the terminal, if it has been already open
  for (const terminal of vscode.window.terminals) {
    if (terminal.name === name) {
      terminal.dispose()
      break
    }
  }

  // Open a new one
  const terminal = vscode.window.createTerminal(name)

  // We can not wait for terminal to be ready so we wait at least a little bit.
  // See: https://github.com/microsoft/vscode-python/issues/15197
  const registration = vscode.window.onDidChangeActiveTerminal(
    (activeTerminal) => {
      if (activeTerminal === terminal) {
        setTimeout(() => {
          terminal.sendText(command)
        }, 1000)
        registration.dispose()
      }
    }
  )
}

/**
 * Escape special characters in the path so that it can be passed into the terminal command.
 *
 * @param path to be escaped
 * @returns [escaped path, error if any]
 */
function escapePath(path: string): [string | null, string | null] {
  // We do not escape double-quotes. This is so uncommon that we ignore it here.
  if (path.includes('"')) {
    return [
      null,
      'Path to the Python file unexpectedly contains double-quotes, ' +
        `so crosshair-vscode can not handle it: ${path}`,
    ]
  }

  const escapedPath = path.includes(' ') ? `"${path}"` : path
  return [escapedPath, null]
}

function inferPathOfActiveFile(): string | null {
  if (!vscode.window.activeTextEditor) {
    return null
  }

  if (!vscode.window.activeTextEditor.document) {
    return null
  }

  if (!vscode.workspace) {
    return null
  }

  const path = vscode.workspace.asRelativePath(
    vscode.window.activeTextEditor.document.fileName
  )
  return path
}

function inferPath(event: any): string | null {
  let path: string | null = null
  if (!event) {
    path = inferPathOfActiveFile()
  } else {
    if (event.fsPath) {
      path = event.fsPath
    } else {
      path = inferPathOfActiveFile()
    }
  }

  return path
}

function inferLine(): number | null {
  if (vscode.window.activeTextEditor === undefined) {
    return null
  }

  const line: number = vscode.window.activeTextEditor.selection.active.line + 1
  return line
}

type CommandWithLineImpl = (
  pythonPath: string,
  escapedPath: string,
  line: number
) => void

/**
 * Takes care of the plumbing so that you can easily add new VS Code commands which depend
 * on the path to the python interpreter, the path to the active file, and the line under the cursor.
 */
function executeCommandWithLine(
  event: any,
  pythonPath: string,
  saveActiveDocument: boolean,
  commandWithLineImpl: CommandWithLineImpl
) {
  if (saveActiveDocument) {
    if (vscode.window.activeTextEditor?.document?.isDirty) {
      vscode.window.activeTextEditor.document.save()
    }
  }

  const path: string | null = inferPath(event)
  if (!path) {
    return
  }

  const [escapedPath, error] = escapePath(path)
  if (error) {
    vscode.window.showErrorMessage(error)
    return
  }

  if (escapedPath === null) {
    vscode.window.showErrorMessage('Unexpected escapedPath null and no error.')
    return
  }

  const line: number | null = inferLine()
  if (line === null) {
    vscode.window.showErrorMessage(
      'Unexpected execution of a command with line when there is no active text editor.'
    )
    return
  }

  commandWithLineImpl(pythonPath, escapedPath, line)
}

type CommandImpl = (pythonPath: string, escapedPath: string) => void

/**
 * Takes care of the plumbing so that you can easily add new VS Code commands which depend
 * on the path to the python interpreter and the path to the active file.
 */
function executeCommand(
  event: any,
  pythonPath: string,
  saveActiveDocument: boolean,
  commandImpl: CommandImpl
) {
  if (saveActiveDocument) {
    if (vscode.window.activeTextEditor?.document?.isDirty) {
      vscode.window.activeTextEditor.document.save()
    }
  }

  const path: string | null = inferPath(event)
  if (!path) {
    return
  }

  const [escapedPath, error] = escapePath(path)
  if (error) {
    vscode.window.showErrorMessage(error)
    return
  }

  if (escapedPath === null) {
    vscode.window.showErrorMessage('Unexpected escapedPath null and no error.')
    return
  }

  commandImpl(pythonPath, escapedPath)
}

function executeCommandAt(event: any, cmdName: string, pythonPath: string) {
  executeCommandWithLine(
    event,
    pythonPath,
    true,
    (pythonPath, escapedPath, line) =>
      executeInRestartedTerminal(
        `crosshair ${cmdName} at`,
        `${pythonPath} -m crosshair ${cmdName} ${escapedPath}:${line}`
      )
  )
}

function executeWatchCommand(event: any, pythonPath: string) {
  executeCommand(event, pythonPath, true, (pythonPath, escapedPath) => {
    const opts = getCommandLineArguments().join(' ')
    const cmd = `${pythonPath} -m crosshair watch ${opts} ${escapedPath}`
    return executeInRestartedTerminal('crosshair watch', cmd)
  })
}

function executeCoverCommand(event: any, pythonPath: string) {
  executeCommandAt(
    event,
    'cover --example_output_format=pytest --per_condition_timeout=5',
    pythonPath
  )
}

function executePickCommand(event: any) {
  const path: string | null = inferPath(event)
  const line: number | null = inferLine()
  const fileName = path ? pathModule.basename(path) : ''

  const quickPick = vscode.window.createQuickPick()
  quickPick.canSelectMany = false
  const items: vscode.QuickPickItem[] = []

  if (localState && localState.lsClient === undefined) {
    items.push({
      label: 'start',
      description: `Start CrossHair background watcher`,
    })
  } else {
    items.push({
      label: 'stop',
      description: `Stop CrossHair background watcher`,
    })
  }
  if (fileName.endsWith('.py')) {
    items.push({
      label: 'watch in terminal',
      description: `Watch ${fileName} with CrossHair in the terminal`,
    })
    if (line !== null) {
      // items.push({
      //   label: 'diff behavior',
      //   description: `Find behavior changes in the function at line ${line}`,
      // })
      items.push({
        label: 'generate tests',
        description: `Generate tests to cover the function at line ${line}`,
      })
    }
  }
  if (localState?.outputChannel) {
    items.push({
      label: 'show logs',
      description:
        'Show the CrossHair background checker logs in the output panel',
    })
  }
  items.push({
    label: 'help',
    description: `Open CrossHair's documentation in your browser`,
  })
  quickPick.items = items

  quickPick.onDidAccept(async (e) => {
    quickPick.hide()
    switch (quickPick.selectedItems.length) {
      case 0:
        break
      case 1:
        {
          const label = quickPick.selectedItems[0].label

          switch (label) {
            case 'start':
              if (localState && localState.lsClient === undefined) {
                await requestServerStart()
              }
              break
            case 'stop':
              if (localState && localState.lsClient !== undefined) {
                await requestServerStop()
              }
              break
            // case 'diff behavior':
            //   executeCommandAt(event, 'diffbehavior', await inferPythonPath())
            //   break
            case 'generate tests':
              executeCoverCommand(event, await inferPythonPath())
              break
            case 'watch in terminal':
              executeWatchCommand(event, await inferPythonPath())
              break
            case 'show logs':
              localState!.outputChannel.show(true)
              break
            case 'help':
              vscode.env.openExternal(
                Uri.parse('https://crosshair.readthedocs.io/en/latest/')
              )
              break
            default:
              vscode.window.showErrorMessage(
                `Bug: unhandled action for crosshair quick pick: ${label}`
              )
              break
          }
        }
        break
      default:
        vscode.window.showErrorMessage(
          'Bug: unexpectedly select multiple actions for crosshair quick pick.'
        )
        break
    }
  })
  quickPick.show()
}

export async function createServer(
  interpreter: string[],
  outputChannel: vscode.OutputChannel
): Promise<LanguageClient | undefined> {
  const command = interpreter[0]
  const serverName = 'CrossHair'

  // Abort if we do not have the required Python dependencies installed:
  try {
    const { stderr } = await promisify(execFile)(
      command,
      interpreter.slice(1).concat(['-c', 'import crosshair, pygls'])
    )
    if (stderr !== '') return undefined
  } catch (e) {
    return undefined
  }

  const workspaces = vscode.workspace.workspaceFolders ?? []
  const projectRoot = workspaces[0].uri.fsPath

  const args = ['-m', 'crosshair', 'server'].concat(getCommandLineArguments())
  outputChannel.appendLine(`Running: ${interpreter.concat(args).join(' ')}`)
  const serverOptions: ServerOptions = {
    command,
    args: interpreter.slice(1).concat(args),
    options: { cwd: projectRoot },
  }

  const clientOptions: LanguageClientOptions = {
    // Register the server for python documents
    documentSelector: [
      { scheme: 'file', language: 'python' },
      { scheme: 'untitled', language: 'python' },
      { scheme: 'vscode-notebook', language: 'python' },
      { scheme: 'vscode-notebook-cell', language: 'python' },
    ],
    outputChannel,
    traceOutputChannel: outputChannel,
    revealOutputChannelOn: RevealOutputChannelOn.Never,
  }

  return new LanguageClient(
    serverName,
    serverName,
    serverOptions,
    clientOptions
  )
}

export async function requestServerStop() {
  if (localState) {
    localState.wantsToRun = false
    if (localState.lsClient) {
      await stopServer()
    }
  }
}

export async function requestServerStart() {
  if (localState) {
    localState.wantsToRun = true
    await restartServer(true)
  }
}

async function stopServer() {
  await localState!.setServerStatus('stopping')
  await localState!.lsClient!.stop()
  localState!.lsClient = undefined
  await localState!.setServerStatus('off')
}

export async function restartServer(showDependencyWarning: boolean = false) {
  const oldLSClient = localState!.lsClient
  if (oldLSClient !== undefined) {
    await stopServer()
  }
  const channel = localState!.outputChannel
  const interpreter = await getInterpreterDetails()
  if (!interpreter.path) {
    return
  }
  const newLSClient = await createServer(interpreter.path, channel)
  if (newLSClient === undefined) {
    channel.appendLine(`Missing Python dependencies - CrossHair will not run.`)
    channel.appendLine(`Install them with 'pip install crosshair pygls'`)
    if (showDependencyWarning) {
      vscode.window.showErrorMessage(
        "CrossHair dependencies are missing. Install them with 'pip install crosshair pygls'"
      )
    }
    return
  }
  channel.appendLine(`Server start requested.`)
  await localState!.setServerStatus('starting')
  try {
    await newLSClient.start()
  } catch (e) {
    await localState!.setServerStatus('off')
    return
  }

  if (localState!.lsClient === undefined) {
    localState!.lsClient = newLSClient
    await localState!.setServerStatus('on')
  } else {
    // A concurrent start beat us; shut ourself down:
    channel.appendLine(
      'client changed underneath during restart; aborting start'
    )
    await newLSClient.stop()
  }
}

class LocalState {
  statusBarItem: vscode.StatusBarItem
  outputChannel: vscode.OutputChannel
  lsClient?: LanguageClient
  serverStatus: string
  wantsToRun: boolean

  constructor(
    statusBarItem: vscode.StatusBarItem,
    outputChannel: vscode.OutputChannel
  ) {
    this.outputChannel = outputChannel
    this.statusBarItem = statusBarItem
    this.serverStatus = 'off'
    this.wantsToRun = vscode.workspace
      .getConfiguration('crosshair-vscode')
      .get('autostart') as boolean
  }

  async setServerStatus(status: string) {
    this.serverStatus = status
    await vscode.commands.executeCommand(
      'setContext',
      'crosshair-vscode.server-status',
      status
    )
    updateStatusBarItem()
  }
}

let localState: LocalState | undefined

export async function activate(context: vscode.ExtensionContext) {
  const channel = vscode.window.createOutputChannel('CrossHair')

  context.subscriptions.push(
    vscode.commands.registerCommand('crosshair-vscode.start', async (event) => {
      if (localState && localState.lsClient === undefined) {
        localState.wantsToRun = true
        await requestServerStart()
      }
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('crosshair-vscode.stop', async (event) => {
      if (localState && localState.lsClient !== undefined) {
        localState.wantsToRun = false
        await requestServerStop()
      }
    })
  )

  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    105
  )
  statusBarItem.command = 'crosshair-vscode.pick'
  context.subscriptions.push(statusBarItem)

  localState = new LocalState(statusBarItem, channel)
  updateStatusBarItem()

  context.subscriptions.push(
    vscode.commands.registerCommand('crosshair-vscode.pick', async (event) =>
      executePickCommand(event)
    )
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('crosshair-vscode.watch', async (event) =>
      executeWatchCommand(event, await inferPythonPath())
    )
  )

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'crosshair-vscode.gentests',
      async (event) => executeCoverCommand(event, await inferPythonPath())
    )
  )

  context.subscriptions.push(
    onDidChangePythonInterpreter(async () => {
      if (localState && localState.wantsToRun) {
        channel.appendLine('interpreter change detected - restarting')
        // There is often an interpreter change near activation; wait a bit to ensure
        // a server with the final interpreter wins:
        await new Promise((resolve) => setTimeout(resolve, 500))
        await restartServer()
      }
    })
  )

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(
      async (e: vscode.ConfigurationChangeEvent) => {
        if (
          e.affectsConfiguration('crosshair-vscode.contract_kind') &&
          localState &&
          localState.wantsToRun
        ) {
          await restartServer()
        }
      }
    )
  )

  return initializePython(context.subscriptions).then(() => {
    if (localState?.wantsToRun) {
      return restartServer()
    }
  })
}

function updateStatusBarItem() {
  if (localState?.statusBarItem !== undefined) {
    const statusBarItem = localState?.statusBarItem
    statusBarItem.text = `CH ${localState?.serverStatus}`
    statusBarItem.show()
  }
}

export async function deactivate() {
  if (localState && localState.lsClient) {
    await localState!.lsClient!.stop()
  }
}
