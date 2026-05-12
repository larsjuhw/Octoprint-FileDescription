/*
 * View model for Octoprint-FileDescription
 *
 * Author: Lars Wolter
 * License: AGPLv3
 */
$(function() {
    function FileDescriptionViewModel(parameters) {
        var self = this;
        self.filesViewModel = parameters[0];
        self.loginState = parameters[1];
        self.access = parameters[2];
        self.file_name = ko.observable('');
        self.file_path = ko.observable('');
        self.file_description = ko.observable('');
        self.file_tags = ko.observable('');
        self.fd_saving = ko.observable(false);
        self.show_error_alert = ko.observable(false);

        self.filesViewModel.FD_can_edit = function() {
            return self.loginState.hasPermission(
                self.access.permissions.PLUGIN_FILEDESCRIPTION_EDIT
            );
        };

        self.filesViewModel.FD_show_edit = function(data) {
            if (!self.filesViewModel.FD_can_edit()) {
                return;
            }

            // Set all observables for the edit panel
            self.file_name(data.name);
            self.file_path(data.path);
            self.file_description(data.fd_description);
            self.file_tags((data.fd_tags || []).join(','));
            self.show_error_alert(false);
            
            $('#FD_edit_menu').modal('show');
        }

        // This replaces OctoPrint's native performSearch function to implement searching for tags. If any other plugin also modifies this, it will not work.
        // Taken from https://github.com/OctoPrint/OctoPrint/blob/9179545c33be8fd3e1e13f24e6730c5df04c31d4/src/octoprint/static/js/app/viewmodels/files.js#L1233-L1260
        // Replacing this function will have better performance than hooking it, but OctoPrint changes could break this in the future.
        self.filesViewModel.performSearch = function (e) {
            var query = this.searchQuery();
            if (query !== undefined && query.trim() !== "") {
                query = query.toLocaleLowerCase();

                var recursiveSearch = function (entry) {
                    if (entry === undefined) {
                        return false;
                    }
                    var success =
                        (entry["display"] &&
                            entry["display"].toLocaleLowerCase().indexOf(query) > -1) ||
                        entry["name"].toLocaleLowerCase().indexOf(query) > -1 ||
                        // Only modification: allow searching for tags
                        entry["fd_tags"] && entry["fd_tags"].some((e) => e.indexOf(query) > -1);
                    if (!success && entry["type"] === "folder" && entry["children"]) {
                        return _.any(entry["children"], recursiveSearch);
                    }
                    return success;
                };
                this.listHelper.changeSearchFunction(recursiveSearch);
            } else {
                this.listHelper.resetSearch();
            }
            return false;
        };

        self.FDSave = function() {
            self.fd_saving(true);
            self.show_error_alert(false);

            let description = self.file_description();
            if (description === undefined) {
                description = '';
            } else {
                description = description.trim();
            }

            let tags = self.file_tags()
            if (tags.length == 0) {
                tags = [];
            } else {
                // Convert the user input to array, trim all tags and remove empty
                tags = tags.split(',').map(t => t.trim()).filter(Boolean);
            }

            let path = self.file_path();

            $.ajax({
                url: API_BASEURL + 'plugin/FileDescription',
                type: 'POST',
                dataType: 'json',
                data: JSON.stringify({
                    command: 'save_new_values',
                    path: path,
                    description: description,
                    tags: tags,
                }),
                contentType: 'application/json; charset-UTF-8'
            }).done(function(data) {
                console.log('FileDescription: saved new values');
                self.fd_saving(false);
                self.filesViewModel.requestData({force: true});
                $('#FD_edit_menu').modal('hide');
            }).fail(function(data) {
                console.log('FileDescription: saving values failed');
                self.fd_saving(false);
                self.show_error_alert(true);
            });
        }

        self.filesViewModel.FD_tagsToText = function(tags) {
            if (tags === undefined) {
                return '';
            }
            return tags.join(', ');
        }
        
        // CURRENTLY DISABLED: https://github.com/larsjuhw/Octoprint-FileDescription/issues/1
        // Hook the additional data toggle function
        // let oldToggleAdditionalData = self.filesViewModel.toggleAdditionalData;
        // self.filesViewModel.toggleAdditionalData = function(data) {
        //     oldToggleAdditionalData(data);
        //     $('.fd-btn', this.getEntryElement(data)).toggle();
        // }
        
        $(document).ready(function() {
            const scriptElement = $('#files_template_machinecode');
            if (!scriptElement.length) {
                return;
            }

            const templateMarkup = scriptElement.html();
            if (!templateMarkup) {
                return;
            }

            const templateRoot = $('<div>' + templateMarkup + '</div>');

            // Add edit button to template
            const actionButtons = templateRoot.find('.btn-group.action-buttons').first();
            if (actionButtons.length && actionButtons.find('.fd-btn').length === 0) {
                const templateButton = $('<div class="btn btn-mini fd-btn" data-bind="visible: $root.FD_can_edit(), click: $root.FD_show_edit" title="Change description and tags"><i class="fas fa-edit"></i></div>');
                actionButtons.append(templateButton);
            }

            // Add description and tags fields to the template
            const uploaded = templateRoot.find('.uploaded').first();
            if (uploaded.length && templateRoot.find('.fd_description').length === 0) {
                const templateDescription =
                    '<div class="fd_description" data-bind="visible:$data.fd_description, click:function(){ $root.FD_show_edit($data); }">Description: ' +
                    '<span data-bind="text: $data.fd_description"></span></div>' +
                    '<div class="fd_tags" data-bind="visible:$data.fd_tags && $data.fd_tags.length>0, click:function(){ $root.FD_show_edit($data); }">Tags: ' +
                    '<span data-bind="text: $root.FD_tagsToText($data.fd_tags)"></span></div>';
                uploaded.before(templateDescription);
            }

            scriptElement.html(templateRoot.html());
        });
    }

    OCTOPRINT_VIEWMODELS.push({
        construct: FileDescriptionViewModel,
        dependencies: [ 'filesViewModel', 'loginStateViewModel', 'accessViewModel' ],
        elements: [ 'div#FD_edit_menu' ]
    });
});
