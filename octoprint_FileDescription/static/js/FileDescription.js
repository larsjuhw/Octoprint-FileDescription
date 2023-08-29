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
        self.file_name = ko.observable('');
        self.file_path = ko.observable('');
        self.file_description = ko.observable('');
        self.file_tags = ko.observable('');
        self.fd_saving = ko.observable(false);
        self.show_error_alert = ko.observable(false);

        self.filesViewModel.FD_show_edit = function(data) {
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
            // Add edit buton to template
            const regex_button = /<div class="btn-group action-buttons">([\s\S]*)<.div>/mi;
            const template_button = '<div class="btn btn-mini fd-btn" data-bind="click: $root.FD_show_edit" title="Change description and tags"><i class="fas fa-edit"></i></div>';
            $('#files_template_machinecode').text(function() {
                return $(this).text().replace(regex_button, '<div class="btn-group action-buttons">$1	' + template_button + '</div>');
            });

            // Add description field to template
            const regex_description = /(<div class="uploaded">Uploaded: <span data-bind="text: formatTimeAgo\(date(?:, '\?')?\), attr: {title: formatDate\(date(?:, {placeholder:'unknown'})?\)}"><\/span><\/div>)/m;
            const template_description = '<div class="fd_description" data-bind="visible:$data.fd_description, click:function(){$root.FD_show_edit($data)}">Description: \
            <span data-bind="text: $data.fd_description"></span></div><div class="fd_tags" data-bind="visible:$data.fd_tags && $data.fd_tags.length>0, click:function(){$root.FD_show_edit($data)}">Tags: \
            <span data-bind="text: $root.FD_tagsToText($data.fd_tags)"></span></div>'
            $('#files_template_machinecode').text(function() {
                return $(this).text().replace(regex_description, template_description + '$1');
            });
        });
    }

    OCTOPRINT_VIEWMODELS.push({
        construct: FileDescriptionViewModel,
        dependencies: [ 'filesViewModel' ],
        elements: [ 'div#FD_edit_menu' ]
    });
});
