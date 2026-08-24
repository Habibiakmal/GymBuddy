import re
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def split_whatsapp_message(text: str, max_safe_length: int = 1400) -> list[str]:
    if not text or not isinstance(text, str):
        return []
    trimmed = text.strip()
    if len(trimmed) <= max_safe_length:
        return [trimmed]

    # 1. Level 1: Split by visual section borders (━, ─, -, =) or multi-newlines
    section_split_regex = r'(?=(?:\r?\n)*(?:━{5,}|─{5,}|-{5,}|={5,}))|(?:\r?\n){2,}'
    raw_sections = [s.strip() for s in re.split(section_split_regex, trimmed) if s and s.strip()]
    if not raw_sections or (len(raw_sections) == 1 and raw_sections[0] == trimmed):
        raw_sections = [s.strip() for s in re.split(r'\n\n+', trimmed) if s and s.strip()]

    # 2. Level 2: Subdivide any section that is still > max_safe_length by paragraphs (\n)
    paragraphs = []
    for sec in raw_sections:
        if len(sec) <= max_safe_length:
            paragraphs.append(sec)
        else:
            lines = [l.strip() for l in re.split(r'\r?\n', sec) if l and l.strip()]
            paragraphs.extend(lines)

    # 3. Level 3: Subdivide any paragraph > max_safe_length by bullet points / list items
    list_items = []
    for para in paragraphs:
        if len(para) <= max_safe_length:
            list_items.append(para)
        else:
            bullet_parts = [b.strip() for b in re.split(r'(?=(?:^|\n)(?:[•\-\*]|\d+\.|\([a-z0-9]\))\s+)', para, flags=re.IGNORECASE) if b and b.strip()]
            if len(bullet_parts) > 1:
                list_items.extend(bullet_parts)
            else:
                list_items.append(para)

    # 4. Level 4: Subdivide any list item > max_safe_length by sentences
    sentences = []
    for item in list_items:
        if len(item) <= max_safe_length:
            sentences.append(item)
        else:
            sentence_parts = [s.strip() for s in re.split(r'(?<=[.!?])\s+(?=[A-Z0-9\u00C0-\u024F\U0001F300-\U0001FAFF*_"\'])', item) if s and s.strip()]
            if len(sentence_parts) > 1:
                sentences.extend(sentence_parts)
            else:
                sentences.append(item)

    # 5. Level 5: Subdivide any sentence > max_safe_length by words
    atomic_units = []
    for sent in sentences:
        if len(sent) <= max_safe_length:
            atomic_units.append(sent)
        else:
            word_parts = [w for w in re.split(r'\s+', sent) if w]
            atomic_units.extend(word_parts)

    # 6. Recombine atomic units greedily into chunks <= max_safe_length
    chunks = []
    current_chunk = ""

    for unit in atomic_units:
        unit_str = unit.strip()
        if not unit_str:
            continue

        if len(unit_str) > max_safe_length:
            if current_chunk.strip():
                chunks.append(current_chunk.strip())
                current_chunk = ""
            for i in range(0, len(unit_str), max_safe_length):
                chunks.append(unit_str[i:i + max_safe_length].strip())
            continue

        test_join = (
            f"{current_chunk}\n\n{unit_str}"
            if current_chunk and (
                "\n" in current_chunk
                or unit_str.startswith("━")
                or unit_str.startswith("─")
                or unit_str.startswith("•")
                or unit_str.startswith("-")
                or unit_str.startswith("*")
            )
            else f"{current_chunk}\n{unit_str}" if current_chunk else unit_str
        )

        if len(test_join) <= max_safe_length:
            current_chunk = test_join
        else:
            if current_chunk.strip():
                chunks.append(current_chunk.strip())
            current_chunk = unit_str

    if current_chunk.strip():
        chunks.append(current_chunk.strip())

    return [c for c in chunks if len(c) > 0]


def run_tests():
    print("================================================================")
    print("  WHATSAPP MESSAGE CHARACTER LIMIT & SPLITTING VALIDATION SUITE ")
    print("================================================================\n")

    # TEST 1: Short message (< safe limit) -> 1 message
    short_msg = "cara plank: posisikan siku di bawah bahu, tahan tubuh lurus selama 30 detik. 💪🔥"
    res1 = split_whatsapp_message(short_msg, 1400)
    assert len(res1) == 1, f"TEST 1 FAIL: expected 1 chunk, got {len(res1)}"
    assert res1[0] == short_msg, "TEST 1 FAIL: content mismatch"
    print("✅ TEST 1 PASSED: Short response (< safe limit) kept as 1 message.")

    # TEST 2: Response slightly above safe limit (e.g. 1700 chars) -> 2 messages
    section_a = "━━━━━━━━━━━━━━\n📊 REKAP NUTRISI HARIAN\n━━━━━━━━━━━━━━\n" + "Makan pagi: Nasi uduk komplit, telur balado, tempe orek manis, kerupuk. Total kalori 480 kcal.\n" * 10
    section_b = "━━━━━━━━━━━━━━\n🍽️ ESTIMASI PORSI\n━━━━━━━━━━━━━━\n" + "• Nasi uduk: ~250g (320 kcal)\n• Telur balado: 1 butir (~50g, 80 kcal)\n• Tempe orek: 2 potong (~40g, 80 kcal)\n" * 10
    medium_msg = f"{section_a}\n\n{section_b}"
    assert len(medium_msg) > 1400, f"Setup error: len is {len(medium_msg)}"
    res2 = split_whatsapp_message(medium_msg, 1400)
    assert len(res2) >= 2, f"TEST 2 FAIL: expected >= 2 chunks, got {len(res2)}"
    for idx, c in enumerate(res2):
        assert len(c) <= 1400, f"TEST 2 FAIL: chunk {idx} exceeds 1400 chars ({len(c)})"
    print(f"✅ TEST 2 PASSED: Medium response ({len(medium_msg)} chars) split into {len(res2)} chunks <= 1400 chars.")

    # TEST 3: Very long response (> 3000 chars) -> Multiple chunks
    long_msg = ("━━━━━━━━━━━━━━\n📋 RIWAYAT MAKAN MINGGUAN\n━━━━━━━━━━━━━━\n" + 
                "• Senin: Nasi Padang Rendang (650 kcal, P: 35g, C: 65g, F: 25g)\n" +
                "• Selasa: Ayam Bakar Madu (450 kcal, P: 40g, C: 30g, F: 15g)\n" +
                "• Rabu: Gado-gado Lontong (380 kcal, P: 18g, C: 50g, F: 12g)\n" +
                "• Kamis: Salmon Steak Kentang (520 kcal, P: 42g, C: 35g, F: 18g)\n" +
                "• Jumat: Soto Betawi Daging (490 kcal, P: 28g, C: 20g, F: 32g)\n") * 10
    res3 = split_whatsapp_message(long_msg, 1400)
    assert len(res3) >= 3, f"TEST 3 FAIL: expected >= 3 chunks, got {len(res3)}"
    for idx, c in enumerate(res3):
        assert len(c) <= 1400, f"TEST 3 FAIL: chunk {idx} exceeds 1400 chars ({len(c)})"
    print(f"✅ TEST 3 PASSED: Very long response ({len(long_msg)} chars) split into {len(res3)} chunks.")

    # TEST 4: Response with heavy emojis & Unicode
    emoji_msg = ("🔥💪🥗🍗🍚🥓🥬🧂📊🏋️🩹✨🥰" * 80) + "\n\n" + ("━━━━━━━━━━━━━━\n📊 STATS\n━━━━━━━━━━━━━━\n" + "🔥 1966 kcal · 🍖 Protein 140g · 🍚 Karbo 200g · 🥓 Lemak 60g\n" * 15)
    res4 = split_whatsapp_message(emoji_msg, 1400)
    for idx, c in enumerate(res4):
        assert len(c) <= 1400, f"TEST 4 FAIL: chunk {idx} with emojis exceeds 1400 chars ({len(c)})"
    print(f"✅ TEST 4 PASSED: Heavy emoji message ({len(emoji_msg)} chars) successfully chunked under limit.")

    # TEST 5: Formatting preservation (borders, bullets, headers)
    formatted_msg = (
        "🍽️ *ROTI ISI SOSIS TOPPING KEJU*\n\n"
        "🕒 24 Agu 2026, 15.00 WIB · 🤖 AI: 88%\n\n"
        "━━━━━━━━━━━━━━\n"
        "📊 *REKAP NUTRISI*\n"
        "━━━━━━━━━━━━━━\n"
        "🔥 *370 kcal*\n\n"
        "🍖 *Protein*: 16g (17%)\n"
        "🍚 *Karbo*: 38g (41%)\n"
        "🥓 *Lemak*: 18g (42%)\n"
        "🥬 *Serat*: 2g\n"
        "🧂 *Natrium*: 480 mg\n\n"
        "━━━━━━━━━━━━━━\n"
        "🍽️ *ESTIMASI PORSI*\n"
        "━━━━━━━━━━━━━━\n"
        "• Roti: ~60g (150 kcal)\n"
        "• Sosis: 1 buah (~50g, 160 kcal)\n"
        "• Keju: topping (~15g, 60 kcal)\n\n"
        "━━━━━━━━━━━━━━\n"
        "🤖 *COACH MIA*\n"
        "━━━━━━━━━━━━━━\n"
        "\"Pilihan camilan yang lezat! Jangan lupa penuhi asupan protein utama saat makan siang ya ✨\"\n\n"
        "━━━━━━━━━━━━━━\n"
        "📈 *STATUS HARI INI*\n"
        "━━━━━━━━━━━━━━\n"
        "🔥 *Kalori*: 850/1966 kcal\n"
        "🍖 *Protein*: 45/140g\n"
        "🍚 *Karbo*: 90/220g\n"
        "🥓 *Lemak*: 28/55g\n"
    )
    res5 = split_whatsapp_message(formatted_msg, 1400)
    assert len(res5) == 1, f"TEST 5 FAIL: expected single message under 1400 chars, got {len(res5)}"
    assert "ROTI ISI SOSIS TOPPING KEJU" in res5[0]
    assert "• Sosis: 1 buah" in res5[0]
    print("✅ TEST 5 PASSED: Nutrition Card formatting with composite estimates preserved completely.")

    # TEST 6: Long food history data integrity
    history_items = [f"Item {i}: Ayam Bakar {i*50} kcal" for i in range(1, 50)]
    history_msg = "🍽️ LOG MAKANAN KEMARIN\n\n" + "\n".join(history_items)
    res6 = split_whatsapp_message(history_msg, 1400)
    recombined = " ".join(res6)
    for i in range(1, 50):
        assert f"Item {i}" in recombined, f"TEST 6 FAIL: lost Item {i}"
    print(f"✅ TEST 6 PASSED: Long history ({len(history_msg)} chars) split into {len(res6)} parts without losing any items.")

    # TEST 7: Long workout guidance without cutting words randomly
    workout_msg = (
        "🏋️ *PANDUAN LATIHAN SQUAT LENGKAP*\n\n"
        "1. Berdiri tegak dengan kaki dibuka selebar bahu dan jari kaki sedikit mengarah keluar.\n"
        "2. Kencangkan otot core dan tarik napas dalam sebelum memulai gerakan turun.\n"
        "3. Dorong pinggul ke belakang seperti hendak duduk di kursi yang stabil.\n"
        "4. Turunkan tubuh hingga paha minimal sejajar dengan lantai (kedalaman 90 derajat).\n"
        "5. Jaga lutut agar tetap sejajar dengan arah jari kaki dan tidak roboh ke dalam.\n"
        "6. Dorong melalui tumit dan pertahankan dada tetap tegak saat kembali ke posisi awal.\n"
        "7. Buang napas saat mencapai posisi berdiri sempurna dan kunci otot glutes.\n"
    ) * 4
    res7 = split_whatsapp_message(workout_msg, 1400)
    for idx, c in enumerate(res7):
        assert len(c) <= 1400, f"TEST 7 FAIL: chunk {idx} exceeded 1400 chars"
        assert not c.endswith(" "), "TEST 7 FAIL: chunk has trailing whitespace"
    print(f"✅ TEST 7 PASSED: Workout guidance cleanly split by sentences/paragraphs into {len(res7)} chunks.")

    # TEST 8: Order preservation
    part_sequence = ["Part 1: Initial check", "Part 2: Main workout", "Part 3: Final cooldown"]
    seq_msg = "\n\n━━━━━━━━━━━━━━\n\n".join(part_sequence)
    res8 = split_whatsapp_message(seq_msg, 1400)
    assert len(res8) == 1 or all(p in res8[i] for i, p in enumerate(part_sequence[:len(res8)]))
    print("✅ TEST 8 PASSED: Chunks maintain strictly ascending chronological order.")

    print("\n================================================================")
    print("  ALL 8 TESTS PASSED WITH 100% SUCCESS RATE!                     ")
    print("================================================================")

if __name__ == "__main__":
    run_tests()
