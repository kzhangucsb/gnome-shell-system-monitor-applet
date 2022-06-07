const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const Gdk = imports.gi.Gdk;
const GLib = imports.gi.GLib;
const ByteArray = imports.byteArray;
const Config = imports.misc.config;

const Gettext = imports.gettext.domain('system-monitor');

let extension = imports.misc.extensionUtils.getCurrentExtension();
let convenience = extension.imports.convenience;

const _ = Gettext.gettext;
const N_ = function (e) {
    return e;
};

let Schema;

const shellMajorVersion = parseInt(Config.PACKAGE_VERSION.split('.')[0]);

function init() {
    convenience.initTranslations();
    Schema = convenience.getSettings();
}

String.prototype.capitalize = function () {
    return this.replace(/(^|\s)([a-z])/g, function (m, p1, p2) {
        return p1 + p2.toUpperCase();
    });
};

function color_to_hex(color) {
    var output = N_('#%02x%02x%02x%02x').format(
        255 * color.red,
        255 * color.green,
        255 * color.blue,
        255 * color.alpha);
    return output;
}



/**
 * @param args.hasBorder Whether the box has a border (true) or not
 * @param args.horizontal Whether the box is horizontal (true)
 *      or vertical (false)
 * @param args.shouldPack Determines whether a horizontal box should have
 *      uniform spacing for its children. Only applies to horizontal boxes
 * @param args.spacing The amount of spacing for a given box
 * @returns a new Box with settings specified by args
 */
function box(args = {}) {
    const options = { };

    if (typeof args.spacing !== 'undefined') {
        options.spacing = args.spacing;
    }

    if (shellMajorVersion < 40) {
        if (args.hasBorder) {
            options.border_width = 10;
        }

        return args.horizontal ?
            new Gtk.HBox(options) : new Gtk.VBox(options);
    }

    if (args.hasBorder) {
        options.margin_top = 10;
        options.margin_bottom = 10;
        options.margin_start = 10;
        options.margin_end = 10;
    }

    options.orientation = args.horizontal ?
        Gtk.Orientation.HORIZONTAL : Gtk.Orientation.VERTICAL;

    const aliasBox = new Gtk.Box(options);

    if (args.shouldPack) {
        aliasBox.set_homogeneous(true);
    }


    aliasBox.add = aliasBox.append;
    aliasBox.pack_start = aliasBox.prepend;
    // normally, this would be append; it is aliased to prepend because
    // that appears to yield the same behavior as version < 40
    aliasBox.pack_end = aliasBox.prepend;

    return aliasBox;
}

const ColorSelect = class SystemMonitor_ColorSelect {
    constructor(name) {
        this.label = new Gtk.Label({label: name + _(':')});
        this.picker = new Gtk.ColorButton();
        this.actor = box({horizontal: true, spacing: 5});
        this.actor.add(this.label);
        this.actor.add(this.picker);
        this.picker.set_use_alpha(true);
    }
    set_value(value) {
        let color = new Gdk.RGBA();

        if (Gtk.get_major_version() >= 4) {
            // GDK did not support parsing hex colours with alpha before GTK 4.
            color.parse(value);
        } else {
            // Use the Compat only when GTK 4 is not available,
            // since it depends on the deprecated Clutter library.
            let Compat = extension.imports.compat;
            let clutterColor = Compat.color_from_string(value);
            let ctemp = [clutterColor.red, clutterColor.green, clutterColor.blue, clutterColor.alpha / 255];
            color.parse('rgba(' + ctemp.join(',') + ')');
        }

        this.picker.set_rgba(color);
    }
}

const IntSelect = class SystemMonitor_IntSelect {
    constructor(name) {
        this.label = new Gtk.Label({label: name + _(':')});
        this.spin = new Gtk.SpinButton();
        this.actor = box({horizontal: true, shouldPack: true, });
        this.actor.add(this.label);
        this.actor.add(this.spin);
        this.spin.set_numeric(true);
    }
    set_args(minv, maxv, incre, page) {
        this.spin.set_range(minv, maxv);
        this.spin.set_increments(incre, page);
    }
    set_value(value) {
        this.spin.set_value(value);
    }
}

const Select = class SystemMonitor_Select {
    constructor(name) {
        this.label = new Gtk.Label({label: name + _(':')});
        // this.label.set_justify(Gtk.Justification.RIGHT);
        this.selector = new Gtk.ComboBoxText();
        this.actor = box({horizontal: true, shouldPack: true, spacing: 5});
        this.actor.add(this.label);
        this.actor.add(this.selector);
    }
    set_value(value) {
        this.selector.set_active(value);
    }
    add(items) {
        items.forEach((item) => {
            this.selector.append_text(item);
        })
    }
}

function set_enum(combo, schema, name) {
    Schema.set_enum(name, combo.get_active());
}

function set_color(color, schema, name) {
    Schema.set_string(name, color_to_hex(color.get_rgba()))
}

function set_string(combo, schema, name, _slist) {
    Schema.set_string(name, _slist[combo.get_active()]);
}

const SettingFrame = class SystemMonitor {
    constructor(name, schema) {
        this.schema = schema;
        this.label = new Gtk.Label({label: name});

        this.vbox = box({horizontal: false, shouldPack: true, spacing: 20});
        this.hbox0 = box({horizontal: true, shouldPack: true, spacing: 20});
        this.hbox1 = box({horizontal: true, shouldPack: true, spacing: 20});
        this.hbox2 = box({horizontal: true, shouldPack: true, spacing: 20});
        this.hbox3 = box({horizontal: true, shouldPack: true, spacing: 20});

        if (shellMajorVersion < 40) {
            this.frame = new Gtk.Frame({border_width: 10});
            this.frame.add(this.vbox);
        } else {
            this.frame = new Gtk.Frame({
                margin_top: 10,
                margin_bottom: 10,
                margin_start: 10,
                margin_end: 10
            });
            this.frame.set_child(this.vbox);
        }


        if (shellMajorVersion < 40) {
            this.vbox.pack_start(this.hbox0, true, false, 0);
            this.vbox.pack_start(this.hbox1, true, false, 0);
            this.vbox.pack_start(this.hbox2, true, false, 0);
            this.vbox.pack_start(this.hbox3, true, false, 0);
        } else {
            this.vbox.append(this.hbox0);
            this.vbox.append(this.hbox1);
            this.vbox.append(this.hbox2);
            this.vbox.append(this.hbox3);
        }
    }

    /** Enforces child ordering of first 2 boxes by label */
    _reorder() {
        if (shellMajorVersion < 40) {
            /** @return {string} label of/inside component */
            const labelOf = el => {
                if (el.get_children) {
                    return labelOf(el.get_children()[0]);
                }
                return el && el.label || '';
            };
            [this.hbox0, this.hbox1].forEach(hbox => {
                hbox.get_children()
                    .sort((c1, c2) => labelOf(c1).localeCompare(labelOf(c2)))
                    .forEach((child, index) => hbox.reorder_child(child, index));
            });
        } else {
            /** @return {string} label of/inside component */
            const labelOf = el => {
                if (el.get_label) {
                    return el.get_label();
                }
                return labelOf(el.get_first_child());
            }

            [this.hbox0, this.hbox1].forEach(hbox => {
                const children = [];
                let next = hbox.get_first_child();

                while (next !== null) {
                    children.push(next);
                    next = next.get_next_sibling();
                }

                const sorted = children
                    .sort((c1, c2) => labelOf(c1).localeCompare(labelOf(c2)));

                sorted
                    .forEach((child, index) => {
                        hbox.reorder_child_after(child, sorted[index - 1] || null);
                    });
            });
        }
    }

    add(key) {
        const configParent = key.substring(0, key.indexOf('-'));
        const config = key.substring(configParent.length + 1);

        // hbox0
        if (config === 'display') {
            let item = new Gtk.CheckButton({label: _('Display')});
            this.hbox0.add(item);
            Schema.bind(key, item, 'active', Gio.SettingsBindFlags.DEFAULT);
        } else if (config === 'show-text') {
            let item = new Gtk.CheckButton({label: _('Show Text')});
            this.hbox0.add(item);
            Schema.bind(key, item, 'active', Gio.SettingsBindFlags.DEFAULT);
        } else if (config === 'show-menu') {
            let item = new Gtk.CheckButton({label: _('Show In Menu')});
            this.hbox0.add(item);
            Schema.bind(key, item, 'active', Gio.SettingsBindFlags.DEFAULT);
        // hbox1
        } else if (config === 'refresh-time') {
            let item = new IntSelect(_('Refresh Time'));
            item.set_args(50, 100000, 1000, 5000);
            this.hbox1.add(item.actor);
            Schema.bind(key, item.spin, 'value', Gio.SettingsBindFlags.DEFAULT);
        } else if (config === 'graph-width') {
            let item = new IntSelect(_('Graph Width'));
            item.set_args(1, 1000, 1, 10);
            this.hbox1.add(item.actor);
            Schema.bind(key, item.spin, 'value', Gio.SettingsBindFlags.DEFAULT);
        } else if (config === 'style') {
            let item = new Select(_('Display Style'));
            item.add([_('digit'), _('graph'), _('both')]);
            item.set_value(this.schema.get_enum(key));
            this.hbox1.add(item.actor);
            item.selector.connect('changed', function (style) {
                set_enum(style, Schema, key);
            });
            // Schema.bind(key, item.selector, 'active', Gio.SettingsBindFlags.DEFAULT);
        // hbox2
        } else if (config.match(/-color$/)) {
            let item = new ColorSelect(_(config.split('-')[0].capitalize()));
            item.set_value(this.schema.get_string(key));
            if (shellMajorVersion < 40) {
                this.hbox2.pack_end(item.actor, true, false, 0);
            } else {
                this.hbox2.append(item.actor);
            }
            item.picker.connect('color-set', function (color) {
                set_color(color, Schema, key);
            });
        } else if (config.match(/sensor-file/)) {
            let sensor_type = configParent === 'fan' ? 'fan' : 'temp';
            let [_slist, _strlist] = convenience.check_sensors(sensor_type);
            let item = new Select(_('Sensor'));
            if (_slist.length === 0) {
                item.add([_('Please install lm-sensors')]);
            } else if (_slist.length === 1) {
                this.schema.set_string(key, _slist[0]);
            }
            item.add(_strlist);
            try {
                item.set_value(_slist.indexOf(this.schema.get_string(key)));
            } catch (e) {
                item.set_value(0);
            }
            // this.hbox3.add(item.actor);
            if (configParent === 'fan') {
                if (shellMajorVersion < 40) {
                    this.hbox2.pack_end(item.actor, true, false, 0);
                } else {
                    this.hbox2.append(item.actor);
                }
            } else if (shellMajorVersion < 40) {
                this.hbox2.pack_start(item.actor, true, false, 0);
            } else {
                this.hbox2.prepend(item.actor);
            }
            item.selector.connect('changed', function (combo) {
                set_string(combo, Schema, key, _slist);
                set_string(combo, Schema, key.replace("file", "label"), _strlist);
            });
        // hbox3
        } else if (config.match(/sensor-label/)) {
            // do nothing
        } else if (config === 'speed-in-bits') {
            let item = new Gtk.CheckButton({label: _('Show network speed in bits')});
            this.hbox3.add(item);
            Schema.bind(key, item, 'active', Gio.SettingsBindFlags.DEFAULT);
        } else if (config === 'individual-cores') {
            let item = new Gtk.CheckButton({label: _('Display Individual Cores')});
            this.hbox3.add(item);
            Schema.bind(key, item, 'active', Gio.SettingsBindFlags.DEFAULT);
        } else if (config === 'time') {
            let item = new Gtk.CheckButton({label: _('Show Time Remaining')});
            this.hbox3.add(item);
            Schema.bind(key, item, 'active', Gio.SettingsBindFlags.DEFAULT);
        } else if (config === 'hidesystem') {
            let item = new Gtk.CheckButton({label: _('Hide System Icon')});
            this.hbox3.add(item);
            Schema.bind(key, item, 'active', Gio.SettingsBindFlags.DEFAULT);
        } else if (config === 'usage-style') {
            let item = new Select(_('Usage Style'));
            item.add([_('pie'), _('bar'), _('none')]);
            item.set_value(this.schema.get_enum(key));
            if (shellMajorVersion < 40) {
                this.hbox3.pack_end(item.actor, false, false, 20);
            } else {
                this.hbox3.append(item.actor);
            }

            item.selector.connect('changed', function (style) {
                set_enum(style, Schema, key);
            });
        } else if (config === 'fahrenheit-unit') {
            let item = new Gtk.CheckButton({label: _('Display temperature in Fahrenheit')});
            this.hbox3.add(item);
            Schema.bind(key, item, 'active', Gio.SettingsBindFlags.DEFAULT);
        } else if (config === 'threshold') {
            let item = new IntSelect(_('Temperature threshold (0 to disable)'));
            item.set_args(0, 300, 5, 5);
            this.hbox3.add(item.actor);
            Schema.bind(key, item.spin, 'value', Gio.SettingsBindFlags.DEFAULT);
        }
        if (configParent.indexOf('gpu') !== -1 &&
            config === 'display') {
            let item = new Gtk.Label({label: _('** Only Nvidia GPUs supported so far **')});
            this.hbox3.add(item);
        }
        this._reorder();
    }
}

const App = class SystemMonitor_App {
    constructor() {
        let setting_items = ['cpu', 'memory', 'swap', 'net', 'disk', 'gpu', 'thermal', 'fan', 'freq', 'battery'];
        let keys = Schema.list_keys();

        this.items = [];
        this.settings = [];

        setting_items.forEach((setting) => {
            this.settings[setting] = new SettingFrame(_(setting.capitalize()), Schema);
        });

        this.main_vbox = box({
            hasBorder: true, horizontal: false, spacing: 10});
        this.hbox1 = box({
            hasBorder: true, horizontal: true, shouldPack: true, spacing: 20});
        if (shellMajorVersion < 40) {
            this.main_vbox.pack_start(this.hbox1, false, false, 0);
        } else {
            this.main_vbox.prepend(this.hbox1);
        }

        keys.forEach((key) => {
            if (key === 'icon-display') {
                let item = new Gtk.CheckButton({label: _('Display Icon')});
                this.items.push(item)
                this.hbox1.add(item)
                Schema.bind(key, item, 'active', Gio.SettingsBindFlags.DEFAULT);
            } else if (key === 'center-display') {
                let item = new Gtk.CheckButton({label: _('Display in the Middle')})
                this.items.push(item)
                this.hbox1.add(item)
                Schema.bind(key, item, 'active', Gio.SettingsBindFlags.DEFAULT);
            } else if (key === 'compact-display') {
                let item = new Gtk.CheckButton({label: _('Compact Display')})
                this.items.push(item)
                this.hbox1.add(item)
                Schema.bind(key, item, 'active', Gio.SettingsBindFlags.DEFAULT);
            } else if (key === 'show-tooltip') {
                let item = new Gtk.CheckButton({label: _('Show tooltip')})
                item.set_active(Schema.get_boolean(key))
                this.items.push(item)
                this.hbox1.add(item)
                Schema.bind(key, item, 'active', Gio.SettingsBindFlags.DEFAULT);
            } else if (key === 'move-clock') {
                let item = new Gtk.CheckButton({label: _('Move the clock')})
                this.items.push(item)
                this.hbox1.add(item)
                Schema.bind(key, item, 'active', Gio.SettingsBindFlags.DEFAULT);
            } else if (key === 'background') {
                let item = new ColorSelect(_('Background Color'))
                item.set_value(Schema.get_string(key))
                this.items.push(item)
                if (shellMajorVersion < 40) {
                    this.hbox1.pack_start(item.actor, true, false, 0)
                } else {
                    this.hbox1.prepend(item.actor)
                }
                item.picker.connect('color-set', function (color) {
                    set_color(color, Schema, key);
                });
            } else {
                let sections = key.split('-');
                if (setting_items.indexOf(sections[0]) >= 0) {
                    this.settings[sections[0]].add(key);
                }
            }
        });
        this.notebook = new Gtk.Notebook()
        setting_items.forEach((setting) => {
            this.notebook.append_page(this.settings[setting].frame, this.settings[setting].label)
            if (shellMajorVersion < 40) {
                this.main_vbox.show_all();
                this.main_vbox.pack_start(this.notebook, true, true, 0)
            } else {
                this.main_vbox.append(this.notebook);
            }
        });
        if (shellMajorVersion < 40) {
            this.main_vbox.show_all();
        }
    }
}

function buildPrefsWidget() {
    let widget = new App();
    return widget.main_vbox;
}
