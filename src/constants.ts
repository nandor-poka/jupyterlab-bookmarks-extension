/** Utilities for Jupyterlab Bookmarks plugin.
 * Copyright (c) 2020, Dr. Nandor Poka, All rights reserved.
 */

// Jupyterlab / Lumino imports
import { IDisposable } from '@lumino/disposable';
import { Menu } from '@lumino/widgets';
import { CommandRegistry } from '@lumino/commands';
import { ILauncher } from '@jupyterlab/launcher';
import { INotebookTracker } from '@jupyterlab/notebook';
import { IDocumentManager } from '@jupyterlab/docmanager';

//Global vars and exports
export const commandPrefix = 'jupyterlab-bookmarks-extension:';
export const VERSION = '0.5.5';
export const TITLE_PLAIN = 'Bookmarks';
export const TITLE_MANAGEMENT = `${TITLE_PLAIN} - Management - ${VERSION}`;
export const TITLE = `${TITLE_PLAIN} - ${VERSION} `;
export const DISABLED_TITLE = `Disabled bookmarks - ${VERSION}`;
export const NOTEBOOK_FACTORY = 'Notebook';
export let notebookTracker: INotebookTracker;
export let docManager: IDocumentManager;
export let commands: CommandRegistry;
export let launcher: ILauncher;
export const UNCATEGORIZED = 'Uncategorized';

// exported variables
export const bookmarkCommands: Map<string, IDisposable> = new Map<
  string,
  IDisposable
>();
export const bookmarkLaunchers: Map<string, IDisposable> = new Map<
  string,
  IDisposable
>();

export const bookmarkMenuItems: Map<string, Menu.IItem> = new Map<
  string,
  Menu.IItem
>();

export const categories: Map<string, Array<IDisposable>> = new Map<
  string,
  Array<IDisposable>
>();

/**
 * Initialises NotebookTracker, DocumentManager, commands, and Launcer object to be shared with other modules if needed.
 * @param nbkTracker
 * @param docMan
 * @param cmds
 * @param launch
 */
export function initConstantsModule(
  nbkTracker: INotebookTracker,
  docMan: IDocumentManager,
  cmds: CommandRegistry,
  launch: ILauncher
): void {
  notebookTracker = nbkTracker;
  docManager = docMan;
  commands = cmds;
  launcher = launch;
}
