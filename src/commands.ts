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
  notebookTracker,
  FAVORITE_ICON
} from './constants';
import {
  syncBookmark,
  addBookmarkItem,
  deleteBookmark,
  addCategory,
  deleteCategory,
  bookmarks
} from './functions';

export const addBookmarkContextMenuCommand = {
  id: commandPrefix + 'addBookmark',
  options: {
    label: 'Add to bookmark to...',
    caption: 'Add to bookmark to a given category',
    execute: async (): Promise<any> => {
      InputDialog.getItem({
        title: 'Select category',
        items: Array.from(categories, item => {
          return item[0];
        })
      }).then(result => {
        const category =
          result.value === undefined ? 'Uncategorized' : result.value;
        const currentDoc = notebookTracker.currentWidget;
        currentDoc.context.fileChanged.connect(syncBookmark);
        const currentDocName = currentDoc.context.contentsModel.name;
        const currentDocPath = currentDoc.context.path;
        addBookmarkItem(
          commands,
          launcher,
          currentDocName,
          currentDocPath,
          category
        );
      });
    }
  }
};

export const addBookmarkLauncherCommand = {
  id: commandPrefix + 'addBookmarkFromLauncher',
  options: {
    label: 'Add bookmark',
    caption: 'Add bookmark',
    icon: FAVORITE_ICON,
    execute: (args: any): void => {
      FileDialog.getOpenFiles({
        manager: docManager,
        filter: model => model.type === 'notebook'
      }).then(result => {
        if (result.button.label !== 'Cancel') {
          result.value.forEach(selectedFile => {
            addBookmarkItem(
              commands,
              launcher,
              selectedFile.name,
              selectedFile.path,
              args.category
            );
          });
        }
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
    execute: (args: any): void => {
      InputDialog.getItem({
        title: 'Select bookmark to delete',
        items:
          args.category === 'all'
            ? Array.from(bookmarkLaunchers, item => {
                return item[0];
              })
            : Array.from(bookmarks, entry => {
                if (entry[1].category === args.category) {
                  return entry[1].title;
                }
              }).filter(title => title !== undefined)
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
      return null;
    }
  }
};
