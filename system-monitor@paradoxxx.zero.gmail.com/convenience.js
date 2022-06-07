/* -*- mode: js; js-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
  Copyright (c) 2011-2012, Giovanni Campagna <scampa.giovanni@gmail.com>

  Redistribution and use in source and binary forms, with or without
  modification, are permitted provided that the following conditions are met:
    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.
    * Neither the name of the GNOME nor the
      names of its contributors may be used to endorse or promote products
      derived from this software without specific prior written permission.

  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
  ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
  WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
  DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE LIABLE FOR ANY
  DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
  (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
  LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
  ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
  (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
  SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

const Gettext = imports.gettext;
const Gio = imports.gi.Gio;

const Config = imports.misc.config;
const ExtensionUtils = imports.misc.extensionUtils;

const ByteArray = imports.byteArray;

/**
 * initTranslations:
 * @domain: (optional): the gettext domain to use
 *
 * Initialize Gettext to load translations from extensionsdir/locale.
 * If @domain is not provided, it will be taken from metadata['gettext-domain']
 */
function initTranslations(domain) {
    let extension = ExtensionUtils.getCurrentExtension();

    domain = domain || extension.metadata['gettext-domain'];

    // check if this extension was built with "make zip-file", and thus
    // has the locale files in a subfolder
    // otherwise assume that extension has been installed in the
    // same prefix as gnome-shell
    let localeDir = extension.dir.get_child('locale');
    if (localeDir.query_exists(null)) {
        Gettext.bindtextdomain(domain, localeDir.get_path());
    } else {
        Gettext.bindtextdomain(domain, Config.LOCALEDIR);
    }
}

/**
 * getSettings:
 * @schema: (optional): the GSettings schema id
 *
 * Builds and return a GSettings schema for @schema, using schema files
 * in extensionsdir/schemas. If @schema is not provided, it is taken from
 * metadata['settings-schema'].
 */
function getSettings(schema) {
    let extension = ExtensionUtils.getCurrentExtension();

    schema = schema || extension.metadata['settings-schema'];

    const GioSSS = Gio.SettingsSchemaSource;

    // check if this extension was built with "make zip-file", and thus
    // has the schema files in a subfolder
    // otherwise assume that extension has been installed in the
    // same prefix as gnome-shell (and therefore schemas are available
    // in the standard folders)
    let schemaDir = extension.dir.get_child('schemas');
    let schemaSource;
    if (schemaDir.query_exists(null)) {
        schemaSource = GioSSS.new_from_directory(schemaDir.get_path(),
            GioSSS.get_default(),
            false);
    } else {
        schemaSource = GioSSS.get_default();
    }

    let schemaObj = schemaSource.lookup(schema, true);
    if (!schemaObj) {
        throw new Error('Schema ' + schema + ' could not be found for extension ' + extension.metadata.uuid + '. Please check your installation.');
    }

    return new Gio.Settings({settings_schema: schemaObj});
}

function parse_bytearray(bytearray) {
  if (!ByteArray.toString(bytearray).match(/GjsModule byteArray/)) {
      return ByteArray.toString(bytearray);
  }
  return bytearray
}

function check_sensors(sensor_type) {
  const hwmon_path = '/sys/class/hwmon/';
  const hwmon_dir = Gio.file_new_for_path(hwmon_path);

  const sensor_files = [];
  const sensor_labels = [];

  function get_label_from(file) {
      if (file.query_exists(null)) {
          // load_contents (and even cat) fails with "Invalid argument" for some label files
          try {
              let [success, contents] = file.load_contents(null);
              if (success) {
                  return String(parse_bytearray(contents)).split('\n')[0];
              }
          } catch (e) {
              log('[System monitor] error loading label from file ' + file.get_path() + ': ' + e);
          }
      }
      return null;
  }

  function add_sensors_from(chip_dir, chip_label) {
      const chip_children = chip_dir.enumerate_children(
          'standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null);
      if (!chip_children) {
          log('[System monitor] error enumerating children of chip ' + chip_dir.get_path());
          return false;
      }

      const input_entry_regex = new RegExp('^' + sensor_type + '(\\d+)_input$');
      let info;
      let added = false;
      while ((info = chip_children.next_file(null))) {
          if (info.get_file_type() !== Gio.FileType.REGULAR) {
              continue;
          }
          const matches = info.get_name().match(input_entry_regex);
          if (!matches) {
              continue;
          }
          const input_ordinal = matches[1];
          const input = chip_children.get_child(info);
          const input_label = get_label_from(chip_dir.get_child(sensor_type + input_ordinal + '_label'));

          sensor_files.push(input.get_path());
          sensor_labels.push(chip_label + ' - ' + (input_label || input_ordinal));
          added = true;
      }
      return added;
  }

  const hwmon_children = hwmon_dir.enumerate_children(
      'standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null);
  if (!hwmon_children) {
      log('[System monitor] error enumerating hwmon children');
      return [[], []];
  }

  let info;
  while ((info = hwmon_children.next_file(null))) {
      if (info.get_file_type() !== Gio.FileType.DIRECTORY || !info.get_name().match(/^hwmon\d+$/)) {
          continue;
      }
      const chip = hwmon_children.get_child(info);
      const chip_label = get_label_from(chip.get_child('name')) || chip.get_basename();

      if (!add_sensors_from(chip, chip_label)) {
          // This is here to provide compatibility with previous code, but I can't find any
          // information about sensors being stored in chip/device directory. Can we delete it?
          const chip_device = chip.get_child('device');
          if (chip_device.query_exists(null)) {
              add_sensors_from(chip_device, chip_label);
          }
      }
  }
  return [sensor_files, sensor_labels];
}