var entries_data = null;
var pokemon_data = null;
var pokemon_name2id = null;
var trainer_names = null;
var trainers_table = null;
var natures = "がんばりや,さみしがり,ゆうかん,いじっぱり,やんちゃ,ずぶとい,すなお,のんき,わんぱく,のうてんき,おくびょう,せっかち,まじめ,ようき,むじゃき,ひかえめ,おっとり,れいせい,てれや,うっかりや,おだやか,おとなしい,なまいき,しんちょう,きまぐれ".split(",");
var silver_tycoon_id = 305;
var gold_tycoon_id = 306;
var trainer_range_table1 = [0, 99, 80, 119, 100, 139, 120, 159, 140, 179, 160, 199, 180, 219, 200, 299];
var trainer_range_table2 = [100, 119, 120, 139, 140, 159, 160, 179, 180, 199, 200, 219, 220, 239, 200, 299];

document.addEventListener("DOMContentLoaded", () => {
    let entries_text;
    let pokedex_csv_text;
    let trainer_names_text;
    let trainers_table_text;

    fetch("data/factory_data.txt")
        .then(r => r.text())
        .then(data => { entries_text = data; boot(); });

    fetch("data/pokedex.csv")
        .then(r => r.text())
        .then(data => { pokedex_csv_text = data; boot(); });

    fetch("data/trainer.txt")
        .then(r => r.text())
        .then(data => { trainer_names_text = data; boot(); });

    fetch("data/tower-trainers-table.txt")
        .then(r => r.text())
        .then(data => { trainers_table_text = data; boot(); });

    function boot() {
        if (!entries_text || !pokedex_csv_text || !trainer_names_text || !trainers_table_text) return;

        setupPokedexData(pokedex_csv_text);
        setupEntriesData(entries_text);
        setupTrainerNames(trainer_names_text);
        setupTrainersTable(trainers_table_text);

        document.forms.f.addEventListener("submit", on_submit);
    }
});

function setupPokedexData(pokedex_csv_text) {
    const lines = pokedex_csv_text.trim().split("\n");
    const boundaries = {"♂のみ": -1, "♀のみ": 255, "1:7": 30, "1:3": 63, "1:1": 126, "3:1": 190, "ふめい": null};

    pokemon_data = new Array(lines.length);
    pokemon_name2id = {};

    for (let i = 0; i < lines.length; i++) {
        const row = lines[i].split(",");
        const name = row[0];
        const stats = row.slice(1, 7).map(Number);
        const ability1 = row[7];
        const ability2 = row[8] || ability1;
        const gender_boundary = boundaries[row[9]];

        pokemon_name2id[name] = i;
        pokemon_data[i] = {
            id: i,
            name,
            stats,
            abilities: [ability1, ability2],
            gender_boundary,
            group: null,
            id_in_group: null
        };
    }
}

function setupEntriesData(text) {
    const lines = text.trim().split("\n");
    entries_data = new Array(lines.length);

    for (let i = 0; i < lines.length; i++) {
        const row = lines[i].split(",");
        const pokemon = getPokemonEntry(row[1]);

        entries_data[i] = {
            id: i,
            name: row[1],
            pokemon,
            nature: natures.indexOf(row[7]),
            item: row[6],
            move: row[2] + ',' + row[3] + ',' + row[4] + ',' + row[5],
            effort: row[8]
        };
    }
}

function setupTrainerNames(trainer_names_text) {
    const lines = trainer_names_text.trim().split("\n");
    trainer_names = lines;
}

function setupTrainersTable(text) {
    const lines = text.trim().split("\n");
    trainers_table = new Array(lines.length);
    for (let i = 0; i < lines.length; i++) {
        trainers_table[i] = lines[i].split(",").map(Number);
    }
}

function on_submit(e) {
    e.preventDefault();
    try {
        on_submit0(this);
    } catch (err) {
        if (!(err instanceof InputError)) throw err;
        alert(err.message);
    }
}

function on_submit0(f) {
    let higawari_seeds = read_higawari_seed(f.kujiids.value);
    const round = read_input(f.round, "周", 1);

    if (f.search_check.checked) {
        const days_range_min = read_input(f.days_range_min, "くじ番号を探す範囲");
        const days_range_max = read_input(f.days_range_max, "くじ番号を探す範囲");
        const today_kuji = read_input(f.today_kuji, "今日のくじ番号", 0, 65535);
        higawari_seeds = search_today_kuji(higawari_seeds, days_range_min, days_range_max, today_kuji);
        if (higawari_seeds.length === 0) {
            input_error("今日のくじ番号は見つかりませんでした");
        }
    }

    const days = read_input(f.days, "経過日数");
    higawari_seeds = higawari_seeds.map(i => HigawariSeed.step(i, days));

    const count = read_input(f.count, "回数");

    const seedSelect = document.querySelector("#higawari-seed-select");
    seedSelect.innerHTML = "";

    if (higawari_seeds.length > 1) {
        let buf = '<p>一致する日替わり乱数のseedが' + higawari_seeds.length + '件あります';
        for (let i = 0; i < higawari_seeds.length; i++) {
            buf += '<br><label><input type="radio" name="higawari-seed-radio" value="' + i + '"' +
                (i === 0 ? ' checked' : '') + '> ' + format_hex(higawari_seeds[i], 8) + '</label>';
        }
        buf += "</p>";
        seedSelect.insertAdjacentHTML("beforeend", buf);

        document.querySelectorAll("#higawari-seed-select input").forEach(el => {
            el.addEventListener("click", () => {
                const n = Number(el.value);
                show_result(higawari_seeds[n], count, round);
            });
        });
    }

    show_result(higawari_seeds[0], count, round);
}

function read_higawari_seed(s) {
    if (/^\s*0x[0-9a-f]+\s*$/i.test(s)) {
        return [Number(s)];
    }
    if (!/^\s*\d+(?:(?:\s*,\s*|\s+)\d+)+\s*$/.test(s)) {
        input_error("くじ番号に入力されている値が不正です");
    }
    const ids = s.match(/\d+/g).map(Number);
    if (ids.length < 2) {
        input_error("くじ番号が2つ以上指定されていません");
    }
    const result = search_higawari_seed(ids);
    if (result.length === 0) {
        input_error("くじ番号に対応するseedが見つかりません");
    }
    return result;
}

function read_input(input, name, min, max) {
    const value = read_int_string(input.value);
    if (min === undefined) min = -Infinity;
    if (max === undefined) max = Infinity;
    if (value !== null && min <= value && value <= max) {
        return value;
    } else {
        input_error(name + "に入力されている値が不正です");
    }
}

function read_int_string(s, default_value) {
    if (/^\s*$/.test(s) && default_value !== undefined) {
        return default_value;
    }
    if (!/^\s*(?:-?\d+|0x[0-9a-f]+)\s*$/i.test(s)) {
        return null;
    }
    return Number(s);
}

function get_checked_radio_value(radios) {
    const index = get_checked_radio_index(radios);
    if (index === null) return null;
    return radios[index].value;
}

function get_checked_radio_index(radios) {
    for (let i = 0; i < radios.length; i++) {
        if (radios[i].checked) return i;
    }
    return null;
}

function input_error(message) {
    throw new InputError(message);
}

function InputError(message) {
    this.message = message;
}

function show_result(higawari_seed, count, round) {
    const seed = TowerFSeed.step(higawari_seed, count + 1);
    const result = document.querySelector("#result");
    result.innerHTML = "";
    result.insertAdjacentHTML("beforeend",
        "<p>日替わり乱数のseed: " + format_hex(higawari_seed, 8) + "</p>"
    );
    show_result0(seed, round);
}

function show_result0(seed, round) {
    let buf = "";
    const prng = new TowerPRNG(seed);
    consume_on_first(prng, round);

    let trainernum = 14;
    const rule = get_checked_radio_value(f.rule);
    if (rule === "single" || rule === "double") {
        trainernum = 7;
    }

    let entrynum = 2;
    if (rule === "single") {
        entrynum = 3;
    } else if (rule === "double") {
        entrynum = 4;
    }

    const trainer_ids = chooseTrainers(prng, round, trainernum);

    let sideTrainerEntries = [];

    if (rule === "npc") {
        prng.rand();
        for (let i = 0; i < 5; i++) {
            const entries = pickEntries(prng, i + 300, entrynum, sideTrainerEntries);
            const tid = prng.rand32();
            const pids = generatePIDs(prng, entries, tid);
            buf += "<p>" + trainer_names[i + 300] + "</p>";
            buf += build_result(i, i + 300, entries, pids);
        }
    }

    for (let i = 0; i < trainernum; i++) {
        const trainer_id = trainer_ids[i];
        const entries = pickEntries(prng, trainer_id, entrynum, sideTrainerEntries);
        const tid = prng.rand32();
        const pids = generatePIDs(prng, entries, tid);

        if (trainernum === 14) {
            if (i % 2 === 0) {
                buf += "<p>" + (i / 2 + 1) + "戦目: " + trainer_names[trainer_id] + "</p>";
                sideTrainerEntries = entries;
            } else {
                buf += "<p>" + ((i - 1) / 2 + 1) + "戦目: " + trainer_names[trainer_id] + "</p>";
                prng.rand();
                sideTrainerEntries = [];
            }
        } else {
            buf += "<p>" + (i + 1) + "戦目: " + trainer_names[trainer_id] + "</p>";
            prng.rand();
        }
        buf += build_result(i, trainer_id, entries, pids);
    }

    document.querySelector("#result").insertAdjacentHTML("beforeend", buf);
}

function consume_on_first(prng, round) {
    prng.step((round - 1) * 24 + 1);
}

function build_result(i, trainer_id, entries, pids) {
    let buf = "";
    buf += "<table><colgroup><col><col><col><col><col><col></colgroup>";

    for (let j = 0; j < entries.length; j++) {
        const entry = entries[j];
        const pokemon = entry.pokemon;
        const pid = pids[j];

        buf += "<tr><th rowspan=2>" + (entry.id + 1) + "<th rowspan=2>" + entry.name +
            "<td>" + entry.item +
            "<td>" + pokemon.abilities[pid % 2] + "<td>" + pidToGender(pid, pokemon) +
            "<td>" + entry.move;

        buf += "<tr><td colspan=4 class=status>性格:" + natures[pid % 25] + " 努力値:" + entry.effort + "</tr>";
    }

    buf += "</table>";
    return buf;
}

function chooseTrainers(prng, round, trainernum) {
    const ids = [];
    const is_single = get_checked_radio_value(f.rule) === "single";

    while (ids.length < trainernum) {
        const senme = (trainernum !== 7 && ids.length <= 11) ? 1 : ids.length;
        const id = pickTrainerID(prng, round, senme, is_single);
        if (ids.indexOf(id) >= 0) continue;
        ids.push(id);
    }
    return ids;
}

function pickTrainerID(prng, round, senme, is_single) {
    if (is_single && senme >= 6) {
        if (round === 3) return silver_tycoon_id;
        if (round === 7) return gold_tycoon_id;
    }
    const table = senme >= 6 ? trainer_range_table2 : trainer_range_table1;
    let begin, end;
    if (round >= 8) {
        begin = 200;
        end = 299;
    } else {
        begin = table[(round - 1) * 2];
        end = table[(round - 1) * 2 + 1];
    }
    return prng.rand() % (end - begin + 1) + begin;
}

function pickEntries(prng, trainer_id, num, sideTrainerEntries) {
    const candidates = trainers_table[trainer_id];
    const isPartner = (trainer_id >= 300 && trainer_id < 305);
    const entries = [];

    while (entries.length < num) {
        const index = prng.rand() % candidates.length;
        const id = candidates[index];
        const entry = entries_data[id - 1];

        if (hasEntryConflict(entry, entries)) continue;
        if (hasEntryConflict(entry, sideTrainerEntries)) continue;
        if (isPartner && hasPartnerConflict(entry)) continue;

        entries.push(entry);
    }
    return entries;
}

function generatePIDs(prng, entries, tid) {
    const pids = [];
    for (let i = 0; i < entries.length; i++) {
        let pid;
        do {
            pid = prng.rand32();
        } while (0);
        pids.push(pid);
    }
    return pids;
}

function hasEntryConflict(entry, entries) {
    for (let i = 0; i < entries.length; i++) {
        if (entry.pokemon === entries[i].pokemon) return true;
        if (entry.item === entries[i].item) return true;
    }
    return false;
}

function hasPartnerConflict(entry) {
    if (entry.name === f.pokemon1.value) return true;
    if (entry.name === f.pokemon2.value) return true;
    if (entry.item === f.item1.value) return true;
    if (entry.item === f.item2.value) return true;
    return false;
}

function getPokemonEntry(name) {
    return pokemon_data[pokemon_name2id[name]];
}

function pidToGender(pid, pokemon) {
    const boundary = pokemon.gender_boundary;
    if (boundary !== null) {
        return (pid & 0xff) > boundary ? "♂" : "♀";
    } else {
        return "―";
    }
}

function format_hex(n, prec) {
    const s = n.toString(16);
    return "0x" + (str_repeat("0", prec - s.length) + s);
}

function str_repeat(s, n) {
    let r = "";
    for (let i = 0; i < n; i++) {
        r += s;
    }
    return r;
}

function LinearCongruentialMethod(a, b) {
    this.a = a;
    this.b = b;
}

LinearCongruentialMethod.prototype.next = function (seed) {
    return mul(seed, this.a) + this.b >>> 0;
};

LinearCongruentialMethod.prototype.step = function (seed, n) {
    let a = this.a;
    let b = this.b;
    n >>>= 0;
    let result = seed >>> 0;
    while (n) {
        if (n & 1) {
            result = mul(result, a) + b >>> 0;
        }
        b = mul(b, a) + b >>> 0;
        a = mul(a, a) >>> 0;
        n >>>= 1;
    }
    return result;
};

var HigawariSeed = new LinearCongruentialMethod(0x6c078965, 1);
var TowerFSeed = new LinearCongruentialMethod(0x5d588b65, 1);

HigawariSeed.to_kuji_seed = function (seed) {
    return mul(seed, 0x41c64e6d) + 0x3039 >>> 0;
};
HigawariSeed.to_kuji_id = function (seed) {
    return HigawariSeed.to_kuji_seed(seed) >>> 16;
};
HigawariSeed.by_kuji_seed = function (seed) {
    return mul(seed, 0xeeb9eb65) + 0xfc77a683 >>> 0;
};

function search_higawari_seed(kujiids) {
    const result = [];
    for (let i = 0; i < 65536; i++) {
        const kujiseed = (kujiids[0] << 16 | i) >>> 0;
        const fseed = HigawariSeed.by_kuji_seed(kujiseed);
        let seed = fseed;
        for (let j = 0; j < kujiids.length; j++) {
            const id = HigawariSeed.to_kuji_id(seed);
            if (kujiids[j] !== id) break;
            if (j === kujiids.length - 1) {
                result.push(seed);
                break;
            }
            seed = HigawariSeed.next(seed);
        }
    }
    return result;
}

function search_today_kuji(seeds, min, max, today_kuji) {
    const result = [];
    for (let i = 0; i < seeds.length; i++) {
        let seed = HigawariSeed.step(seeds[i], min);
        for (let j = min; j <= max; j++) {
            if (HigawariSeed.to_kuji_id(seed) === today_kuji) {
                result.push(seed);
            }
            seed = HigawariSeed.next(seed);
        }
    }
    return result;
}

function TowerPRNG(seed) {
    this.seed = seed >>> 0;
}

TowerPRNG.Seed = new LinearCongruentialMethod(0x02e90edd, 1);

TowerPRNG.prototype.rand = function () {
    this.seed = mul(this.seed, 0x02e90edd) + 1 >>> 0;
    return this.seed / 0xffff & 0xffff;
};

TowerPRNG.prototype.rand32 = function () {
    const low = this.rand();
    const high = this.rand();
    return (high << 16 | low) >>> 0;
};

TowerPRNG.prototype.step = function (n) {
    this.seed = TowerPRNG.Seed.step(this.seed, n);
};

function mul(a, b) {
    const a1 = a >>> 16;
    const a2 = a & 0xffff;
    const b1 = b >>> 16;
    const b2 = b & 0xffff;
    return (((a1 * b2 + a2 * b1) << 16) + a2 * b2) >>> 0;
}
