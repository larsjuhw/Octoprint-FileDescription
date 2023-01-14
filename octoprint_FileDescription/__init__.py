# coding=utf-8
from __future__ import absolute_import

import octoprint.plugin

class FiledescriptionPlugin(
    octoprint.plugin.StartupPlugin,
    octoprint.plugin.AssetPlugin,
    octoprint.plugin.TemplatePlugin,
    octoprint.plugin.SimpleApiPlugin,
):

    def on_after_startup(self):
        self._storage_interface = self._file_manager._storage("local")

    def get_assets(self):
        return {
            'js': ['js/FileDescription.js'],
            'css': ['css/FileDescription.css'],
        }

    def get_api_commands(self):
        return {
            'save_new_values': ['path', 'description', 'tags'],
        }

    def on_api_command(self, command, data):
        import flask
        from octoprint.server import user_permission
        if not user_permission.can():
            return flask.make_response('Insufficient rights', 401)

        if command == 'save_new_values':
            path = data['path']
            tags = data['tags']
            description = data.get('description', '')

            if not isinstance(tags, list):
                return flask.make_response('Tags must be an array', 400)
            if not self._storage_interface.file_exists(path):
                return flask.make_response('No file exists at path', 400)
            if not isinstance(description, str):
                return flask.make_response('Description must be string', 400)
            if not self._storage_interface.file_exists(path):
                return flask.make_response('No file exists at path', 400)

            self._logger.info(f'Setting description of "{path}" to "{description}" and tags to "{tags}"')
            self._storage_interface.set_additional_metadata(path, 'fd_description', description, overwrite=True)
            self._storage_interface.set_additional_metadata(path, 'fd_tags', tags, overwrite=True)

    ##~~ Softwareupdate hook

    def get_update_information(self):
        return {
            "FileDescription": {
                "displayName": "Filedescription Plugin",
                "displayVersion": self._plugin_version,

                # version check: github repository
                "type": "github_release",
                "user": "larsjuhw",
                "repo": "Octoprint-FileDescription",
                "current": self._plugin_version,
                "stable_branch": {
                    "name": "Stable",
                    "branch": "master",
                    "comittish": ["master"],
                }, "prerelease_branches": [
                    {
                        "name": "Release Candidate",
                        "branch": "rc",
                        "comittish": ["rc", "master"],
                    }
                ],
                # update method: pip
                "pip": "https://github.com/larsjuhw/Octoprint-FileDescription/archive/{target_version}.zip",
            }
        }


__plugin_name__ = "FileDescription"
__plugin_pythoncompat__ = ">=3,<4"

def __plugin_load__():
    global __plugin_implementation__
    __plugin_implementation__ = FiledescriptionPlugin()

    global __plugin_hooks__
    __plugin_hooks__ = {
        "octoprint.plugin.softwareupdate.check_config": __plugin_implementation__.get_update_information
    }
