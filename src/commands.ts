/** Commands for Jupyterlab Bookmarks plugin.
 * Copyright (c) 2020, Dr. Nandor Poka, All rights reserved.
 */

// Jupyterlab / Lumino imports

import { closeIcon, addIcon, redoIcon } from '@jupyterlab/ui-components';
import { FileDialog } from '@jupyterlab/filebrowser';
import { InputDialog, showErrorMessage } from '@jupyterlab/apputils';

// Custom imports
import {
  commandPrefix,
  bookmarkLaunchers,
  categories,
  FAVORITE_ICON,
  UNCATEGORIZED,
  getBookmarks,
  getNotebookTracker,
  getCommands,
  getLauncher,
  getDocManager
} from './constants';
import {
  syncBookmark,
  addBookmarkItem,
  deleteBookmark,
  addCategory,
  deleteCategory
} from './functions';

/**
 * This command is used when the user opens the context menu (makes a right click)
 * of an open notebook, and selects `Add bookmark to...` menu.
 */
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
        if (result.button.label !== 'Cancel') {
          const category =
            result.value === undefined ? 'Uncategorized' : result.value;
          const currentDoc = getNotebookTracker().currentWidget;
          currentDoc.context.fileChanged.connect(syncBookmark);
          const currentDocName = currentDoc.context.contentsModel.name;
          const currentDocPath = currentDoc.context.path;
          addBookmarkItem(
            getCommands(),
            getLauncher(),
            currentDocName,
            currentDocPath,
            category
          );
        }
      });
    }
  }
};

/**
 * This command is used by the `Launcher's` `Add Bookmark` items.
 * The item in the `Management` category let's the user select a category to add the bookmark to.
 * The items in the custom (user defined) categories always provide the category they belong to via the `arg`
 * JSON object.
 * The bookmark is then added to the selected category.
 */
export const addBookmarkLauncherCommand = {
  id: commandPrefix + 'addBookmarkFromLauncher',
  options: {
    label: 'Add bookmark',
    caption: 'Add bookmark',
    icon: FAVORITE_ICON,
    execute: (args: any): void => {
      if (args.category) {
        FileDialog.getOpenFiles({
          manager: getDocManager(),
          filter: model => model.type === 'notebook'
        }).then(result => {
          if (result.button.label !== 'Cancel') {
            result.value.forEach(selectedFile => {
              addBookmarkItem(
                getCommands(),
                getLauncher(),
                selectedFile.name,
                selectedFile.path,
                args.category
              );
            });
          }
        });
      } else {
        InputDialog.getItem({
          title: 'Select category',
          items: Array.from(categories, item => {
            return item[0];
          })
        }).then(result => {
          if (result.button.label !== 'Cancel') {
            const category =
              result.value === undefined ? 'Uncategorized' : result.value;
            FileDialog.getOpenFiles({
              manager: getDocManager(),
              filter: model => model.type === 'notebook'
            }).then(result => {
              if (result.button.label !== 'Cancel') {
                result.value.forEach(selectedFile => {
                  addBookmarkItem(
                    getCommands(),
                    getLauncher(),
                    selectedFile.name,
                    selectedFile.path,
                    category
                  );
                });
              }
            });
          }
        });
      }
    }
  }
};
/**
 * This command is used to remove a bookmark. The argument of the command is the category
 * to remove the bookmark from. The command only lists bookmarks for removal that belong to that
 * category. If the command is invoked from the `Management` section, then all bookmarks are listed.
 */
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
            : Array.from(getBookmarks(), entry => {
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

/**
 * Adds a category to the launcher. Empty names are not allowed
 * and eventually duplicates are refused to be added.
 * Newly added categories are initialized with the two built-in command:
 * add and delete bookmark.
 */
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
          if (
            result.value === null ||
            result.value === '' ||
            result.value === undefined
          ) {
            showErrorMessage(
              'Invalid category name',
              'Category name cannot be empty.'
            );
          } else {
            addCategory(categoryToAdd);
          }
        }
      });
    }
  }
};

/**
 * Deletes a category. The `Uncategorized` category cannot be deleted.
 * Eventually the bookmarks from the deleted category will be moved to the `Uncategorized`
 * section.
 */
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
          if (categoryToDelete === UNCATEGORIZED) {
            showErrorMessage(
              'Category cannot be deleted',
              `The default "${UNCATEGORIZED}" category cannot be deleted.`
            );
          } else {
            deleteCategory(categoryToDelete);
          }
        }
      });
    }
  }
};

/**
 * Not used for the moment.
 */
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
