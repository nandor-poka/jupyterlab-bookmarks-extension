import json

from notebook.base.handlers import APIHandler
from notebook.utils import url_path_join
import tornado
import os
import logging
import shutil

_extension_home_dir = os.path.join(os.environ["HOME"],'.jl-bookmarks')
if not os.path.exists(_extension_home_dir):
    ## Create <USER_HOME/.jl-bookmarks dir if it doesn't exists.
    try:
        os.mkdir(_extension_home_dir)

    except OSError:
        print(f'Could not create extension home dir at: {_extension_home_dir}')


_log_file_path = os.path.join(os.environ["HOME"],'.jl-bookmarks', 'JL-Bookmarks.log')
_settings_file_path = os.path.join(os.environ["HOME"],'.jl-bookmarks', 'settings.json')
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)
formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
logFileHandler = logging.FileHandler(_log_file_path, mode='a', encoding='utf-8', delay=False)
logFileHandler.setFormatter(formatter)
logger.addHandler(logFileHandler)
logger.propagate=False

_bookmarks = None

class SettingsHandler(APIHandler):
    # Saving extension settings to disk, thus making it persistent.

    @tornado.web.authenticated
    def get(self):
        if not os.path.exists(_settings_file_path):
            self.finish(
                json.dumps({
                    'result': False,
                    'reason':'Settings file does not exist.'
                })
            )
        else:
            try:
                with open (_settings_file_path, mode='r') as settings_file:
                    settings = settings_file.read()
                    settings_file.close()
                    self.finish(
                        json.dumps({
                            'result': True,
                            'settings': settings
                        })
                    )
            except OSError as ex:
                logger.exception(f'Failed to read settings file at {_settings_file_path}.\n{ex}')
                self.finish(
                    json.dumps({
                        'result': False,
                        'reason': f'Failed to read settings file at {_settings_file_path}.\n{ex}'
                    })
                )

    @tornado.web.authenticated
    def post(self):
        if not os.path.exists(_extension_home_dir):
        ## Create <USER_HOME/.jl-bookmarks dir if it doesn't exists.
            try:
                os.mkdir(_extension_home_dir)
            except OSError as ex:
                logger.exception(f'Failed to save settings. Extension home directory does not exist and could not create it\n{ex}')
                self.finish(
                    json.dumps({
                        'result': False,
                        'reason': f'Failed to save settings. Extension home directory does not exist and could not create it\n{ex}'
                    })
                )
        else:
            try:
                with open (_settings_file_path, mode='w') as settings_file:
                    settings = self.get_json_body()
                    settings_file.write(
                        json.dumps({
                            'bookmarks':settings["bookmarks"]
                        })
                    )
                    settings_file.close()
                    self.finish(
                        json.dumps({
                            'result': True
                        })
                    )
            except Exception as ex:
                logger.exception(f'Failed to save settings.\n{ex}')
                self.finish(
                    json.dump
                )

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
            # Data structure is [string, Bookmark][]
            bookmarks = data["bookmarksData"]
            for bookmark in bookmarks:
                logger.debug(f'Updating bookmark {bookmark}')
                bookmarkBasePath = bookmark[1]["basePath"]
                disabled = False
                bookmarkAbsPath = bookmark[1]["absPath"]
                if not os.path.exists(os.path.join(self.root_dir, bookmarkBasePath)):
                    logger.debug(f'{os.path.join(self.root_dir, bookmarkBasePath)} does not exist. Bookmark not accessible from current JL root dir.')
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
                            shutil.copy(bookmarkAbsPath, os.path.join(self.root_dir, '.tmp'+os.path.sep+bookmark[1]["title"]))
                            bookmark[1]["activePath"] ='.tmp'+os.path.sep+bookmark["title"] #index 3
                        except Exception as ex:
                            logger.error(f'Failed to copy {bookmarkAbsPath} to {".tmp"+os.path.sep+bookmark[1]["title"]} .\n{ex}')
                    else:
                        # we leave paths JL root path and abs path as is and set temp_path to empty
                        bookmark[1]["activePath"]='' #index 3
                    # finally we set
                    bookmark[1]["disabled"] = disabled # index 4
                else:
                    # In this case the bookmark is accessible directly from current JL root.
                    # we set temp_path to JL root path
                    logger.debug('Bookmark available from JL root.')
                    bookmark[1]["activePath"] = bookmark[1]["basePath"]
                    bookmark[1]["disabled"] = False# index 4
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
        logger.debug(f'Getting absolute path for: {bookmarkItem}')
        bookmarkPath = bookmarkItem["basePath"]
        error = False
        reason = None
        try:
            bookmarkAbsPath = os.path.abspath(bookmarkPath)
        except Exception as ex:
            logger.error(f'Failed to determine absolute path for {bookmarkPath}')
            error = True
            reason = str(ex)
        bookmarkItem["absPath"] = bookmarkAbsPath
        bookmarkItem["activePath"] = bookmarkPath
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
            shutil.copy(bookmark["activePath"], bookmark["absPath"])
            self.finish(json.dumps({
                'success': True
            }))
        except Exception as ex:
            self.finish(json.dumps({
                'success': False,
                'reason': str(ex)
            }))

class ImportBookmarksHandler(APIHandler):
    @tornado.web.authenticated
    def post(self):
        try:
            bookmark_file_content = self.get_json_body()
            if bookmark_file_content["bookmarks"] is None:
                logger.error('Error during importing bookmarks from file. No bookmarks property found in JSON.')
                self.finish(json.dumps({
                    'success':False,
                    'reason': 'No bookmarks found in JSON.'
                }))
            with open (_settings_file_path, mode='w') as settings_file:
                json.dump(bookmark_file_content, settings_file)
                settings_file.close()
            self.finish(
                json.dumps({
                    'success':True
                })
            )
        except Exception as ex:
            logger.error(f'Failed to import bookmarks.\n{ex}')
            self.finish(
                json.dumps({
                    'success':False,
                    'reason':f'{ex}'
                })
            )

class ExportBookmarksHandler(APIHandler):
    @tornado.web.authenticated
    def get(self):
        try:
            with open (_settings_file_path, mode='r') as settings_file:
                data = settings_file.read()
                settings_file.close()
            self.finish(json.dumps({
                'success': True,
                'content': data
            }))
        except OSError as ex:
            logger.error(f'Failed to export bookmarks.\n{ex}')
            self.clear_header('Content-Disposition')
            self.set_header('Content-Type', 'application/json')
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
    settings_pattern = url_path_join(base_url, "jupyterlab-bookmarks-extension", "settings")
    import_bookmarks_pattern = url_path_join(base_url, "jupyterlab-bookmarks-extension", "importBookmarks")
    export_bookmarks_pattern = url_path_join(base_url, "jupyterlab-bookmarks-extension", "exportBookmarks")
    handlers = [
        (update_bookmarks_pattern, UpdateBookmarksHandler),
        (getAbsPath_pattern, getAbsPathHandler),
        (syncBookmark_pattern, SyncBookmarkHandler),
        (settings_pattern, SettingsHandler),
        (import_bookmarks_pattern, ImportBookmarksHandler),
        (export_bookmarks_pattern, ExportBookmarksHandler)
    ]
    web_app.add_handlers(host_pattern, handlers)
    logger.info('JupyterLab Bookmarks extension has started.')
