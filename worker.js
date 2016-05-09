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
            url: "images/tinix.img",
        },

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
    var el = $("status");
    //el.style.display = "block";

    if(e.th === e.sh - 1 && e.loaded >= e.total - 2048)
    {
        // last file is (almost) loaded
        el.innerHTML = "Download completed.";
        return;
    }

    var line = "Downloading images " + e.th;

    if(typeof e.th === "number" && e.sh)
    {
        line += "[" + (e.th + 1) + "/" + e.sh + "] ";
    }

    if(e.total && typeof e.loaded === "number")
    {
        var per100 = Math.floor(e.loaded / e.total * 100);
        per100 = Math.min(100, Math.max(0, per100));

        var per50 = Math.floor(per100 / 2);

        line += per100 + "%";
    }
    else
    {
        line += chr_repeat(".", progress_ticks++ % 50);
    }

    el.innerHTML = line;
}

function init_ui(emulator)
{

    function toHex(num)
    {//将一个数字转化成16进制字符串形式
        return num<16?"0x0"+num.toString(16).toUpperCase():"0x"+num.toString(16).toUpperCase();
    }
    var last_tick = 0;
    var running_time = 0;
    var last_instr_counter = 0;
    var interval;

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
        $("eip").textContent = emulator.get_statistics()["eip"];
        $("cpl").textContent = emulator.get_statistics()["cpl"] == 0 ? "kernel" : "user";
        $("eflags").textContent = emulator.get_statistics()["flags"];
        $("paging").textContent = emulator.get_statistics()["paging"] ? "true" : "false";
        $("protect").textContent = emulator.get_statistics()["protected_mode"] ? "true" : "false";

        var registers = emulator.get_statistics()["registers"];

        $("eax").textContent = registers[reg_eax];
        $("ebx").textContent = registers[reg_ebx];
        $("ecx").textContent = registers[reg_ecx];
        $("edx").textContent = registers[reg_edx];
        $("esp").textContent = registers[reg_esp];
        $("ebp").textContent = registers[reg_ebp];
        $("esi").textContent = registers[reg_esi];
        $("edi").textContent = registers[reg_edi];


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
}


function $(id)
{
    var el = document.getElementById(id);

    if(!el)
    {
        dbg_log("Element with id `" + id + "` not found");
    }

    return el;
}



