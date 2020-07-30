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
import { LabIcon } from '@jupyterlab/ui-components';
import { ISettingRegistry } from '@jupyterlab/settingregistry';

// Custom imports
import favorite from '../style/favorite.svg';
import { Bookmark } from './bookmark';

//Global vars and exports
export const commandPrefix = 'jupyterlab-bookmarks-extension:';
export const VERSION = '0.5.5';
export const TITLE_PLAIN = 'Bookmarks';
export const TITLE_MANAGEMENT = `${TITLE_PLAIN} - Management - ${VERSION}`;
export const TITLE = `${TITLE_PLAIN} - ${VERSION} `;
export const DISABLED_TITLE = `Disabled bookmarks - ${VERSION}`;
export const NOTEBOOK_FACTORY = 'Notebook';
export const UNCATEGORIZED = 'Uncategorized';
export const FAVORITE_ICON = new LabIcon({
  name: commandPrefix + 'FavoriteIcon',
  svgstr: favorite
});

// internal variables accessed via exported getters, cannot be directly redefined.
let notebookTracker: INotebookTracker;
let docManager: IDocumentManager;
let commands: CommandRegistry;
let launcher: ILauncher;

/**
 * The extension's settings.
 */
let settingsObject: ISettingRegistry.ISettings = null;

/**
 * Data structure is Map<string, Bookmark> => {title: Bookmark}
 */
let bookmarks: Map<string, Bookmark> = new Map<string, Bookmark>();

// exported constants
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

/**
 * Sets the global `bookmarks` object to the parameter.
 * @param incomingBookmarks `Map<string, Bookmark>` to set the `bookmarks` to
 */
export function setBookmarks(incomingBookmarks: Map<string, Bookmark>): void {
  bookmarks = incomingBookmarks;
}

/**
 * Returns the `bookmark` Map.
 */
export function getBookmarks(): Map<string, Bookmark> {
  return bookmarks;
}

/**
 * Getter for the settings object
 */
export function getSettingsObject(): ISettingRegistry.ISettings {
  return settingsObject;
}

/**
 * Setter for the `settingsObject`.
 * @param incomingSettingsObject
 */
export function setSettingsObject(
  incomingSettingsObject: ISettingRegistry.ISettings
): void {
  settingsObject = incomingSettingsObject;
}
/**
 * Getter for the `launcher` that is injected via the `ILauncher` token at runtime.
 */
export function getLauncher(): ILauncher {
  return launcher;
}

/**
 * Getter for the `docManager` that is injected via the `IDocumentManager` token at runtime.
 */
export function getDocManager(): IDocumentManager {
  return docManager;
}

/**
 * Getter for the application's command registry.
 */
export function getCommands(): CommandRegistry {
  return commands;
}

/**
 * Getter for the `notebookTracker` that is injected via the `INotebookTracker` token at runtime.
 */
export function getNotebookTracker(): INotebookTracker {
  return notebookTracker;
}
