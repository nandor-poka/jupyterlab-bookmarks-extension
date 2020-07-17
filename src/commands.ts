/** Commands for Jupyterlab Bookmarks plugin.
 * Copyright (c) 2020, Dr. Nandor Poka, All rights reserved.
 */

// Jupyterlab / Lumino imports
import { INotebookTracker } from '@jupyterlab/notebook';
import { closeIcon, addIcon } from '@jupyterlab/ui-components';
import { FileDialog } from '@jupyterlab/filebrowser';
import { InputDialog } from '@jupyterlab/apputils';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { ILauncher } from '@jupyterlab/launcher';
import { CommandRegistry } from '@lumino/commands';

// Custom imports
import {
  commandPrefix,
  syncBookmark,
  addBookmarkItem,
  deleteBookmark,
  bookmarkLaunchers
} from './utils';

// local variables
let notebookTracker: INotebookTracker;
let docManager: IDocumentManager;
let commands: CommandRegistry;
let launcher: ILauncher;

export function initCommandsModule(
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

export const addBookmarkContextMenuCommand = {
  id: commandPrefix + 'addBookmark',
  options: {
    label: 'Add to bookmarks',
    caption: 'Add to bookmarks',
    execute: async (): Promise<any> => {
      const currentDoc = notebookTracker.currentWidget;
      currentDoc.context.fileChanged.connect(syncBookmark);
      const currentDocName = currentDoc.context.contentsModel.name;
      const currentDocPath = currentDoc.context.path;
      addBookmarkItem(commands, launcher, currentDocName, currentDocPath);
    }
  }
};

export const addBookmarkLauncherCommand = {
  id: commandPrefix + 'addBookmarkFromLauncher',
  options: {
    label: 'Add bookmark',
    caption: 'Add bookmark',
    icon: addIcon,
    execute: (): void => {
      FileDialog.getOpenFiles({
        manager: docManager,
        filter: model => model.type === 'notebook'
      }).then(result => {
        result.value.forEach(selectedFile => {
          addBookmarkItem(
            commands,
            launcher,
            selectedFile.name,
            selectedFile.path
          );
        });
      });
    }
  }
};

export const removeBookmarkCommand = {
  id: commandPrefix + 'removeBookmark',
  options: {
    label: 'Delete Bookmark',
    caption: 'Delete Bookmark',
    icon: closeIcon,
    execute: (): void => {
      InputDialog.getItem({
        title: 'Select bookmark to delete',
        items: Array.from(bookmarkLaunchers, item => {
          return item[0];
        })
      }).then(async result => {
        if (result.button.label !== 'Cancel') {
          const bookmarkToDelete: string = result.value;
          deleteBookmark(bookmarkToDelete);
        }
      });
    }
  }
};
