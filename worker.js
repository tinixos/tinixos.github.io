"use strict";

var emulator;
var 
/** @const */ reg_eax = 0,
/** @const */ reg_ecx = 1,
/** @const */ reg_edx = 2,
/** @const */ reg_ebx = 3,
/** @const */ reg_esp = 4,
/** @const */ reg_ebp = 5,
/** @const */ reg_esi = 6,
/** @const */ reg_edi = 7;


window.onload = function()
{
    //<option value="123">CD / Hard Disk / Floppy</option>
    var query_args = get_query_arguments();
    var img = query_args["img"];
    var iso = query_args["iso"];
    var dsk = query_args["dsk"];
    //var bo;

    if(query_args["dsk"]) {
        dsk = query_args["dsk"];
    }

    if(query_args["iso"]) {
        iso = query_args["iso"];
    }

    if(query_args["img"]) {
        img = query_args["img"];
    }

    if (typeof(img) == "undefined" && typeof(iso) == "undefined" && typeof(dsk) == "undefined") 
    {
        img = "images/tinix.img";
    }

    set_title($("image_path").value);

    emulator = new V86Starter({

        memory_size: 64 * 1024 * 1024,
        vga_memory_size: 2 * 1024 * 1024,
        bios: {
            url: "bios/seabios.bin",
        },
        vga_bios: {
            url: "bios/vgabios.bin",
        },
        fda: {
            url: img,
        },
        hda: {
            url: dsk,
        },
        cdrom: {
            url: iso,
        },

        //"boot_order": parseInt(bo, 16) || 0,

        screen_container: $("screen_container"),
        autostart: true,
    });

    emulator.add_listener("emulator-ready", function()
    {
        init_ui(emulator);
    });

    emulator.add_listener("download-progress", function(e)
    {
        show_progress(e);
    });
}

/**
 * @return {Object.<string, string>}
 */
function get_query_arguments()
{
    var query = location.search.substr(1).split("&");
    var parameters = {};

    for(var i = 0; i < query.length; i++)
    {
        var param = query[i].split("=");
        parameters[param[0]] = decodeURIComponent(param[1]);
    }

    return parameters;
}

function onpopstate(e)
{
    location.reload();
}

function set_title(text)
{
    document.title = text + " - Virtual x86";
}

function set_profile(prof)
{
    if(window.history.pushState)
    {
        window.history.pushState({ profile: prof }, "", "?" + prof);
    }
}

function time2str(time)
{
    if(time < 60)
    {
        return time + "s";
    }
    else if(time < 3600)
    {
        return (time / 60 | 0) + "m " + (time % 60) + "s";
    }
    else
    {
        return (time / 3600 | 0) + "h " +
            ((time / 60 | 0) % 60) + "m " +
            (time % 60) + "s";
    }
}

var progress_ticks = 0;

function show_progress(e)
{
    var per100 = Math.floor(e.loaded / e.total * 100);

    $("process").style.display = "block";
    
    $("image_name").textContent = (e.th+1).toString() + "/" + (e.sh).toString() + "  " + e.uh;
    $("image_size").textContent = (e.loaded).toString() + " / " + (e.total).toString();
    $("load_process").textContent = per100.toString() + "% ";

    if(e.th === e.sh - 1 && e.loaded >= e.total - 2048)
    {
        $("process").style.display = "none";
        return;
    }

}

function init_ui(emulator)
{

    var last_tick = 0;
    var running_time = 0;
    var last_instr_counter = 0;
    var interval;

    /**
    *
    *  Javascript sprintf
    *
    *
    **/

    var sprintfWrapper = {
      init : function () {
        if (typeof arguments == "undefined") { return null; }
        if (arguments.length < 1) { return null; }
        if (typeof arguments[0] != "string") { return null; }
        if (typeof RegExp == "undefined") { return null; }
        var string = arguments[0];
        var exp = new RegExp(/(%([%]|(\-)?(\+|\x20)?(0)?(\d+)?(\.(\d)?)?([bcdfosxX])))/g);
        var matches = new Array();
        var strings = new Array();
        var convCount = 0;
        var stringPosStart = 0;
        var stringPosEnd = 0;
        var matchPosEnd = 0;
        var newString = '';
        var match = null;
        while (match = exp.exec(string)) {
          if (match[9]) { convCount += 1; }
          stringPosStart = matchPosEnd;
          stringPosEnd = exp.lastIndex - match[0].length;
          strings[strings.length] = string.substring(stringPosStart, stringPosEnd);
          matchPosEnd = exp.lastIndex;
          matches[matches.length] = {
            match: match[0],
            left: match[3] ? true : false,
            sign: match[4] || '',
            pad: match[5] || ' ',
            min: match[6] || 0,
            precision: match[8],
            code: match[9] || '%',
            negative: parseInt(arguments[convCount]) < 0 ? true : false,
            argument: String(arguments[convCount])
          };
        }
        strings[strings.length] = string.substring(matchPosEnd);
        if (matches.length == 0) { return string; }
        if ((arguments.length - 1) < convCount) { return null; }
        var code = null;
        var match = null;
        var i = null;
        var substitution;
        for (i=0; i<matches.length; i++) {
          if (matches[i].code == '%') { substitution = '%' }
          else if (matches[i].code == 'b') {
            matches[i].argument = String(Math.abs(parseInt(matches[i].argument)).toString(2));
            substitution = sprintfWrapper.convert(matches[i], true);
          }
          else if (matches[i].code == 'c') {
            matches[i].argument = String(String.fromCharCode(parseInt(Math.abs(parseInt(matches[i].argument)))));
            substitution = sprintfWrapper.convert(matches[i], true);
          }
          else if (matches[i].code == 'd') {
            matches[i].argument = String(Math.abs(parseInt(matches[i].argument)));
            substitution = sprintfWrapper.convert(matches[i]);
          }
          else if (matches[i].code == 'f') {
            matches[i].argument = String(Math.abs(parseFloat(matches[i].argument)).toFixed(matches[i].precision ? matches[i].precision : 6));
            substitution = sprintfWrapper.convert(matches[i]);
          }
          else if (matches[i].code == 'o') {
            matches[i].argument = String(Math.abs(parseInt(matches[i].argument)).toString(8));
            substitution = sprintfWrapper.convert(matches[i]);
          }
          else if (matches[i].code == 's') {
            matches[i].argument = matches[i].argument.substring(0, matches[i].precision ? matches[i].precision : matches[i].argument.length)
            substitution = sprintfWrapper.convert(matches[i], true);
          }
          else if (matches[i].code == 'x') {
            matches[i].argument = String(Math.abs(parseInt(matches[i].argument)).toString(16));
            substitution = sprintfWrapper.convert(matches[i]);
          }
          else if (matches[i].code == 'X') {
            matches[i].argument = String(Math.abs(parseInt(matches[i].argument)).toString(16));
            substitution = sprintfWrapper.convert(matches[i]).toUpperCase();
          }
          else {
            substitution = matches[i].match;
          }
          newString += strings[i];
          newString += substitution;
        }
        newString += strings[i];
        return newString;
      },
      convert : function(match, nosign){
        if (nosign) {
          match.sign = '';
        } else {
          match.sign = match.negative ? '-' : match.sign;
        }
        var l = match.min - match.argument.length + 1 - match.sign.length;
        var pad = new Array(l < 0 ? 0 : l).join(match.pad);
        if (!match.left) {
          if (match.pad == "0" || nosign) {
            return match.sign + pad + match.argument;
          } else {
            return pad + match.sign + match.argument;
          }
        } else {
          if (match.pad == "0" || nosign) {
            return match.sign + match.argument + pad.replace(/0/g, ' ');
          } else {
            return match.sign + match.argument + pad;
          }
        }
      }
    }
    var sprintf = sprintfWrapper.init;

    function update_info()
    {
        var now = Date.now();

        //time
        var instruction_counter = emulator.get_instruction_counter();
        var last_ips = instruction_counter - last_instr_counter;

        last_instr_counter = instruction_counter;

        var delta_time = now - last_tick;
        running_time += delta_time;
        last_tick = now;

        $("speed").textContent = last_ips / delta_time | 0;
        $("running_time").textContent = time2str(running_time / 1000 | 0);

        //register
        $("eip").textContent = sprintf("0x%08X", emulator.get_statistics()["eip"] >= 0 ? emulator.get_statistics()["eip"] : emulator.get_statistics()["eip"] + 0x100000000);
        $("cpl").textContent = emulator.get_statistics()["cpl"] == 0 ? "kernel" : "user";
        $("eflags").textContent = sprintf("0x%08X", emulator.get_statistics()["flags"] >= 0 ? emulator.get_statistics()["flags"] : emulator.get_statistics()["flags"] + 0x100000000);
        $("paging").textContent = emulator.get_statistics()["paging"] ? "true" : "false";
        $("protect").textContent = emulator.get_statistics()["protected_mode"] ? "true" : "false";

        var registers = emulator.get_statistics()["registers"];

        $("eax").textContent = sprintf("0x%08X", registers[reg_eax] >= 0 ? registers[reg_eax] : registers[reg_eax] + 0x100000000);
        $("ebx").textContent = sprintf("0x%08X", registers[reg_ebx] >= 0 ? registers[reg_ebx] : registers[reg_ebx] + 0x100000000);
        $("ecx").textContent = sprintf("0x%08X", registers[reg_ecx] >= 0 ? registers[reg_ecx] : registers[reg_ecx] + 0x100000000);
        $("edx").textContent = sprintf("0x%08X", registers[reg_edx] >= 0 ? registers[reg_edx] : registers[reg_edx] + 0x100000000);
        $("esp").textContent = sprintf("0x%08X", registers[reg_esp] >= 0 ? registers[reg_esp] : registers[reg_esp] + 0x100000000);
        $("ebp").textContent = sprintf("0x%08X", registers[reg_ebp] >= 0 ? registers[reg_ebp] : registers[reg_ebp] + 0x100000000);
        $("esi").textContent = sprintf("0x%08X", registers[reg_esi] >= 0 ? registers[reg_esi] : registers[reg_esi] + 0x100000000);
        $("edi").textContent = sprintf("0x%08X", registers[reg_edi] >= 0 ? registers[reg_edi] : registers[reg_edi] + 0x100000000);
    }

    emulator.add_listener("emulator-started", function()
    {
        last_tick = Date.now();
        interval = setInterval(update_info, 100);
    });

    emulator.add_listener("emulator-stopped", function()
    {
        update_info();
        clearInterval(interval);
    });

    var stats_9p = {
        read: 0,
        write: 0,
    };

    emulator.add_listener("screen-set-mode", function(is_graphical)
    {
        if(is_graphical)
        {
            $("info_vga_mode").textContent = "Graphical";
        }
        else
        {
            $("info_vga_mode").textContent = "Text";
        }
    });


    $("run").onclick = function()
    {
        if(emulator.is_running())
        {
            $("run").value = "Resume";
            emulator.stop();
        }
        else
        {
            $("run").value = "Pause";
            emulator.run();
        }

        update_info();
        $("run").blur();
    };

    $("reset").onclick = function()
    {
        emulator.restart();
        $("reset").blur();
    };

    $("ctrlaltdel").onclick = function()
    {
        emulator.keyboard_send_scancodes([
            0x1D, // ctrl
            0x38, // alt
            0x53, // delete

            // break codes
            0x1D | 0x80,
            0x38 | 0x80,
            0x53 | 0x80,
        ]);

        $("ctrlaltdel").blur();
    };

    var showstatus = "none";
    $("showstatus").onclick = function()
    {
        if (showstatus == "none") 
        {
            showstatus = "block";
            $("runtime_infos").style.display = "block";
        }
        else
        {
            showstatus = "none";
            $("runtime_infos").style.display = "none";
        }
    };

    $("screen_container").onclick = function()
    {
        // allow text selection
        if(window.getSelection().isCollapsed)
        {
            //document.getElementsByClassName("phone_keyboard")[0].focus();
        }
    };

    $("image_path").onchange = function()
    {
        var img = $("image_path").value;

        if (img.indexOf(".img") > 0)
        {
            set_profile("img=" + img);
        }
        else if (img.indexOf(".iso") > 0) 
        {
            set_profile("iso=" + img);
        }
        else if (img.indexOf(".dsk") > 0) 
        {
            set_profile("dsk=" + img);
        }


        emulator.stop();
        location.reload();
        //location.href = location.pathname;
    };
}


function $(id)
{
    var el = document.getElementById(id);

    if(!el)
    {
        console.log("Element with id `" + id + "` not found");
    }

    return el;
}



