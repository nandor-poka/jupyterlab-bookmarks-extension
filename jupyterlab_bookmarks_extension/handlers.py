import json

from notebook.base.handlers import APIHandler
from notebook.utils import url_path_join
import tornado
import os
import logging
import shutil

_log_file_path = os.path.join(os.environ["HOME"], 'JL-Bookmarks.log')

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)
formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
logFileHandler = logging.FileHandler(_log_file_path, mode='a', encoding='utf-8', delay=False)
logFileHandler.setFormatter(formatter)
logger.addHandler(logFileHandler)
logger.propagate=False

_bookmarks = None

class UpdateBookmarksHandler(APIHandler):
    @property
    def contents_manager(self):
        """Currently configured notebook server ContentsManager."""
        return self.settings['contents_manager']

    @property
    def root_dir(self):
        """Root directory to scan."""
        return self.contents_manager.root_dir

    @tornado.web.authenticated
    def post(self):
        try:
            data = self.get_json_body()
            """Data structure is Array of arrays => [[0:name, 1:path in current JL root, 2:absolute_path, 3:temp_path, 4:<disabled]]"""
            bookmarks = data["bookmarksData"]
            for bookmark in bookmarks:
                logger.debug(bookmark)
                bookmarkPath = bookmark[1]
                disabled = False
                bookmarkAbsPath = bookmark[2]
                if not os.path.exists(os.path.join(self.root_dir, bookmarkPath)):
                    logger.debug(f'{os.path.join(self.root_dir, bookmarkPath)} does not exist. Bookmark not accessible from current JL root dir.')
                    # if we get here, then the current bookmark item is not accessible from the current JL root dir
                    # in this case we should make .tmp dir in current root and copy the bookmarked item
                    # and then use this path in the JL Launcher. Syncing back to the original file is important.
                    
                    if not os.path.exists(bookmarkAbsPath):
                        logger.debug(f'{bookmarkAbsPath} does not exist.')
                        disabled = True

                    # create .tmp dir if it doesn't exist yet
                    if not os.path.exists(os.path.join(self.root_dir, '.tmp')):
                        os.mkdir('.tmp')

                    if not disabled:
                        # if we've got an abosolute path then we copy it to the local .tmp dir and push it to the bookmark item data.
                        try:
                            shutil.copy(bookmarkAbsPath, os.path.join(self.root_dir, '.tmp'+os.path.sep+bookmark[0]))
                            bookmark[3] ='.tmp'+os.path.sep+bookmark[0] #index 3
                        except Exception as ex:
                            logger.error(f'Failed to copy {bookmarkAbsPath} to {".tmp"+os.path.sep+bookmark[0]} .\n{ex}')
                    else:
                        # we leave paths JL root path and abs path as is and set temp_path to empty
                        bookmark[3]='' #index 3
                    # finally we set
                    bookmark[4] = str(disabled) # index 4
                else:
                    # In this case the bookmark is accessible directly from current JL root.
                    # we set temp_path to JL root path
                    logger.debug('Bookmark available from JL root.')
                    bookmark[3] = bookmark[1]
                    bookmark[4] = str(False) # index 4
                logger.debug(bookmark)
            _bookmarks = bookmarks
            self.finish(
                json.dumps({
                    'bookmarks':_bookmarks
                })
            )
        except Exception as ex:
            logger.exception(f'Startup failed because: {ex}')
            self.finish({})
            
class getAbsPathHandler(APIHandler):

    @tornado.web.authenticated
    def post(self):
        #Data structure [name, path in current JL root, absolute_path, temp_path, disabled]
        bookmarkItem = self.get_json_body()
        bookmarkPath = bookmarkItem[1]
        error = False
        reason = None
        try:
            bookmarkAbsPath = os.path.abspath(bookmarkPath)
        except Exception as ex:
            logger.error(f'Failed to determine absolute path for {bookmarkPath}')
            error = True
            reason = str(ex)
        bookmarkItem[2] = bookmarkAbsPath
        bookmarkItem[3] = bookmarkItem[1]
        self.finish(json.dumps({
            'bookmarkItem': bookmarkItem,
            'error': error,
            'reason': reason
        }))

class SyncBookmarkHandler(APIHandler):
    @tornado.web.authenticated
    def post(self):
        bookmark = self.get_json_body()
        try:
            shutil.copy(bookmark[3], bookmark[2])
            self.finish(json.dumps({
                'success': True
            }))
        except Exception as ex:
            self.finish(json.dumps({
                'success': False,
                'reason': str(ex)
            }))

def setup_handlers(web_app):
    host_pattern = ".*$"
    
    base_url = web_app.settings["base_url"]
    update_bookmarks_pattern = url_path_join(base_url, "jupyterlab-bookmarks-extension", "updateBookmarks")
    getAbsPath_pattern = url_path_join(base_url, "jupyterlab-bookmarks-extension", "getAbsPath")
    syncBookmark_pattern = url_path_join(base_url, "jupyterlab-bookmarks-extension", "syncBookmark")
    handlers = [
        (update_bookmarks_pattern, UpdateBookmarksHandler),
        (getAbsPath_pattern, getAbsPathHandler),
        (syncBookmark_pattern, SyncBookmarkHandler)
        ]
    web_app.add_handlers(host_pattern, handlers)
    logger.info('JupyterLab Bookmarks extension has started.')
