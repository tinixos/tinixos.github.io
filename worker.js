"use strict";

var emulator;

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

function chr_repeat(chr, count)
{
    var result = "";

    while(count-- > 0)
    {
        result += chr;
    }

    return result;
}

var progress_ticks = 0;

function show_progress(e)
{
    var el = $("status");
    //el.style.display = "block";

    if(e.sh === e.rh - 1 && e.loaded >= e.total - 2048)
    {
        // last file is (almost) loaded
        el.innerHTML = "Done downloading. Starting now ...";
        return;
    }

    var line = "Downloading images ";

    if(typeof e.sh === "number" && e.rh)
    {
        line += "[" + (e.sh + 1) + "/" + e.rh + "] ";
    }

    if(e.total && typeof e.loaded === "number")
    {
        var per100 = Math.floor(e.loaded / e.total * 100);
        per100 = Math.min(100, Math.max(0, per100));

        var per50 = Math.floor(per100 / 2);

        line += per100 + "% [";
        line += chr_repeat("#", per50);
        line += chr_repeat(" ", 50 - per50) + "]";
    }
    else
    {
        line += chr_repeat(".", progress_ticks++ % 50);
    }

    el.innerHTML = line;
}

function init_ui(emulator)
{

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

        $("run").blur();
    };


    var last_tick = 0;
    var running_time = 0;
    var last_instr_counter = 0;
    var interval;

    function update_info()
    {
        var now = Date.now();

        var instruction_counter = 0;//emulator.get_instruction_counter();
        var last_ips = instruction_counter - last_instr_counter;

        last_instr_counter = instruction_counter;

        var delta_time = now - last_tick;
        running_time += delta_time;
        last_tick = now;

        $("speed").textContent = last_ips / delta_time | 0;
        $("avg_speed").textContent = instruction_counter / running_time | 0;
        $("running_time").textContent = time2str(running_time / 1000 | 0);
    }

    emulator.add_listener("emulator-started", function()
    {
        last_tick = Date.now();
        interval = setInterval(update_info, 1000);
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

    emulator.add_listener("9p-read-start", function()
    {
        $("info_filesystem").style.display = "block";
        $("info_filesystem_status").textContent = "Loading ...";
    });
    emulator.add_listener("9p-read-end", function(args)
    {
        stats_9p.read += args[1];

        $("info_filesystem_status").textContent = "Idle";
        $("info_filesystem_last_file").textContent = args[0]
        $("info_filesystem_bytes_read").textContent = stats_9p.read;
    });
    emulator.add_listener("9p-write-end", function(args)
    {
        stats_9p.write += args[1];

        $("info_filesystem_last_file").textContent = args[0]
        $("info_filesystem_bytes_written").textContent = stats_9p.write;
    });

    var stats_storage = {
        read: 0,
        read_sectors: 0,
        write: 0,
        write_sectors: 0,
    };

    emulator.add_listener("ide-read-start", function()
    {
        $("info_storage").style.display = "block";
        $("info_storage_status").textContent = "Loading ...";
    });
    emulator.add_listener("ide-read-end", function(args)
    {
        stats_storage.read += args[1];
        stats_storage.read_sectors += args[2];

        $("info_storage_status").textContent = "Idle";
        $("info_storage_bytes_read").textContent = stats_storage.read;
        $("info_storage_sectors_read").textContent = stats_storage.read_sectors;
    });
    emulator.add_listener("ide-write-end", function(args)
    {
        stats_storage.write += args[1];
        stats_storage.write_sectors += args[2];

        $("info_storage_bytes_written").textContent = stats_storage.write;
        $("info_storage_sectors_written").textContent = stats_storage.write_sectors;
    });


    emulator.add_listener("screen-set-mode", function(is_graphical)
    {
        if(is_graphical)
        {
            $("info_vga_mode").textContent = "Graphical";
        }
        else
        {
            $("info_vga_mode").textContent = "Text";
            $("info_res").textContent = "-";
            $("info_bpp").textContent = "-";
        }
    });

    emulator.add_listener("screen-set-size-graphical", function(args)
    {
        $("info_res").textContent = args[0] + "x" + args[1];
        $("info_bpp").textContent = args[2];
    });

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



