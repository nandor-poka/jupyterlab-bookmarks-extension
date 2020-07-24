/** Commands for Jupyterlab Bookmarks plugin.
 * Copyright (c) 2020, Dr. Nandor Poka, All rights reserved.
 */

// Jupyterlab / Lumino imports

import { closeIcon, addIcon, redoIcon } from '@jupyterlab/ui-components';
import { FileDialog } from '@jupyterlab/filebrowser';
import { InputDialog } from '@jupyterlab/apputils';

// Custom imports
import {
  commandPrefix,
  bookmarkLaunchers,
  categories,
  launcher,
  docManager,
  commands,
  notebookTracker
} from './constants';
import {
  syncBookmark,
  addBookmarkItem,
  deleteBookmark,
  addCategory,
  deleteCategory
} from './functions';

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
      addBookmarkItem(commands, launcher, currentDocName, currentDocPath, '');
    }
  }
};

export const addBookmarkLauncherCommand = {
  id: commandPrefix + 'addBookmarkFromLauncher',
  options: {
    label: 'Add bookmark',
    caption: 'Add bookmark',
    icon: addIcon,
    execute: (args: any): void => {
      FileDialog.getOpenFiles({
        manager: docManager,
        filter: model => model.type === 'notebook'
      }).then(result => {
        result.value.forEach(selectedFile => {
          addBookmarkItem(
            commands,
            launcher,
            selectedFile.name,
            selectedFile.path,
            args.categoryToAdd
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

export const addCategoryCommand = {
  id: commandPrefix + 'addCategory',
  options: {
    label: 'Add category',
    caption: 'Add new bookmark category',
    icon: addIcon,
    execute: (): void => {
      InputDialog.getText({
        title: 'Add new category'
      }).then(result => {
        if (result.button.label !== 'Cancel') {
          const categoryToAdd: string = result.value;
          addCategory(categoryToAdd);
        }
      });
    }
  }
};

export const deleteCategoryCommand = {
  id: commandPrefix + 'deleteCategory',
  options: {
    label: 'Delete category',
    caption: 'Delete category',
    icon: closeIcon,
    execute: (): void => {
      InputDialog.getItem({
        title: 'Delete category',
        items: Array.from(categories, item => {
          return item[0];
        })
      }).then(result => {
        if (result.button.label !== 'Cancel') {
          const categoryToDelete: string = result.value;
          deleteCategory(categoryToDelete);
        }
      });
    }
  }
};

export const moveToCategoryCommand = {
  id: commandPrefix + 'moveToCategory',
  options: {
    label: 'Move to category',
    caption: 'Move to category',
    icon: redoIcon,
    execute: (): void => {
      console.log('moving bookmark to category...');
      return null;
    }
  }
};
