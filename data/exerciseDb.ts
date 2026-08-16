export interface ExerciseItem {
  id: string;
  name: string;
  indonesianName: string;
  aliases: string[];
  equipmentCategory: "machine" | "cable" | "barbell" | "dumbbell" | "bodyweight" | "smith_machine" | "kettlebell" | "cardio";
  equipmentName: string;
  bodyPart: "chest" | "back" | "legs" | "shoulders" | "arms" | "core" | "full_body" | "cardio";
  targetMuscles: string[];
  secondaryMuscles?: string[];
  equipmentSetup: string[];
  instructions: string[];
  dosAndDonts: {
    dos: string[];
    donts: string[];
  };
  coachCues: {
    max: string;
    mia: string;
  };
  recommendedSetsReps: string;
  gifUrl: string;
  thumbnailUrl?: string;
}

export const EXERCISE_DATABASE: ExerciseItem[] = [
  {
    id: "lat-pulldown",
    name: "Lat Pulldown Machine",
    indonesianName: "Mesin Lat Pulldown (Tarik Sayap)",
    aliases: ["lat pulldown", "lat pull down", "pulldown", "mesin sayap", "tarik punggung", "lat pull down machine", "cable pulldown", "alat tarik punggung"],
    equipmentCategory: "machine",
    equipmentName: "Seated Lat Pulldown Machine",
    bodyPart: "back",
    targetMuscles: ["Latissimus Dorsi (Sayap Punggung)", "Teres Major"],
    secondaryMuscles: ["Biceps", "Rhomboids", "Rear Deltoids", "Trapezius"],
    equipmentSetup: [
      "Atur bantalan paha (thigh pad) agar menahan paha dengan pas dan tidak terangkat saat beban berat ditarik.",
      "Pilih beban pin pada tumpukan beban (weight stack) yang sesuai dengan repetisi target (mulai dari beban ringan dulu).",
      "Pilih pegangan wide-bar (stang lebar) atau grip netral (V-bar)."
    ],
    instructions: [
      "Berdiri untuk meraih stang dengan pegangan overhand (telapak tangan menghadap ke depan), selebar 1.5x lebar bahu.",
      "Duduk di kursi dan kunci paha di bawah bantalan penahan.",
      "Tegakkan badan, busungkan dada sedikit, dan condongkan tubuh ke belakang sekitar 10-15 derajat.",
      "Tarik stang ke bawah menuju bagian atas dada sambil mengarahkan siku ke bawah dan ke samping belakang.",
      "Rapatkan tulang belikat (squeeze shoulder blades) di bagian bawah gerakan selama 1 detik.",
      "Lepaskan stang kembali ke atas secara perlahan (2-3 detik) hingga otot punggung terasa meregang penuh."
    ],
    dosAndDonts: {
      dos: [
        "Fokus menarik menggunakan siku dan otot punggung, bukan hanya otot tangan/bicep.",
        "Jaga dada tetap membusung sepanjang gerakan.",
        "Kontrol tempo saat stang kembali ke atas."
      ],
      donts: [
        "Jangan menarik stang ke belakang leher (berbahaya untuk sendi bahu).",
        "Jangan mengayunkan badan terlalu ke belakang untuk memanfaatkan momentum.",
        "Jangan membiarkan bahu terangkat hingga menutupi telinga di posisi atas."
      ]
    },
    coachCues: {
      max: "Inget bro, tarik pake siku lo ke bawah! Rasain otot sayap punggung lo mengembang dan terkunci kuat. Bantai 4 set x 10-12 reps!",
      mia: "Tarik perlahan ke arah dada atas ya, rasakan kontraksi lembut di punggung dan jaga napas tetap teratur. Semangat! ✨"
    },
    recommendedSetsReps: "3-4 Set x 10-12 Repetisi (Rest 60-90s)",
    gifUrl: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Lat_Pulldown/0.jpg"
  },
  {
    id: "barbell-bench-press",
    name: "Flat Barbell Bench Press",
    indonesianName: "Bench Press Barbel Datar (Dada Tengah)",
    aliases: ["bench press", "barbell bench press", "flat bench", "press dada", "angkat barbel dada", "alat bench press", "flat barbell press"],
    equipmentCategory: "barbell",
    equipmentName: "Olympic Flat Bench & Barbell",
    bodyPart: "chest",
    targetMuscles: ["Pectoralis Major (Otot Dada Utama)"],
    secondaryMuscles: ["Anterior Deltoids (Bahu Depan)", "Triceps Brachii"],
    equipmentSetup: [
      "Pastikan posisi barbel di rak setinggi jangkauan lengan saat siku sedikit menekuk (mudah di-unrack).",
      "Kunci pelat beban dengan safety clamp / collar di kedua sisi barbel.",
      "Atur posisi tubuh berbaring datar dengan mata sejajar tepat di bawah barbel."
    ],
    instructions: [
      "Berbaring di bangku dengan 5 titik tumpu (kepala, punggung atas, bokong, kaki kiri, kaki kanan menapak kuat di lantai).",
      "Genggam barbel sedikit lebih lebar dari bahu (kunci ibu jari melingkari barbel / safe grip).",
      "Kunci tulang belikat ke belakang dan ke bawah (retract & depress scapula).",
      "Angkat barbel dari rak (unrack) hingga stabil tepat di atas dada.",
      "Tarik napas dan turunkan barbel secara terkontrol ke bagian tengah dada (sekitar garis puting), siku membentuk sudut ~45-75 derajat.",
      "Sentuh dada ringan (tanpa memantulkan) lalu dorong barbel kuat ke atas sambil membuang napas."
    ],
    dosAndDonts: {
      dos: [
        "Kaki harus menapak kokoh di lantai untuk menjaga leg drive & stabilitas.",
        "Pertahankan lekukan alami punggung bawah (slight arch) tanpa mengangkat bokong dari bangku.",
        "Kunci pergelangan tangan agar tetap lurus sejajar dengan lengan bawah."
      ],
      donts: [
        "Jangan gunakan suicide grip (ibu jari tidak melingkar) bagi pemula.",
        "Jangan memantulkan barbel di tulang dada (bouncing).",
        "Jangan melebarkan siku 90 derajat sejajar bahu (risiko cedera rotator cuff)."
      ]
    },
    coachCues: {
      max: "Tancepin kaki lo ke lantai, busungin dada, dorong sekuat tenaga! Jangan lupa safety clip selalu dipasang. Gas!",
      mia: "Jaga stabilitas dan kontrol bebannya ya. Fokus pada kontraksi otot dada di setiap dorongan. ✨"
    },
    recommendedSetsReps: "4 Set x 8-10 Repetisi (Rest 90-120s)",
    gifUrl: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Bench_Press/0.jpg"
  },
  {
    id: "incline-dumbbell-press",
    name: "Incline Dumbbell Press",
    indonesianName: "Incline Dumbbell Press (Dada Atas)",
    aliases: ["incline dumbbell press", "incline press", "dumbbell incline", "press dada atas", "incline bench dumbbell", "incline db press"],
    equipmentCategory: "dumbbell",
    equipmentName: "Adjustable Incline Bench & Dumbbells",
    bodyPart: "chest",
    targetMuscles: ["Clavicular Pectoralis (Dada Bagian Atas)"],
    secondaryMuscles: ["Anterior Deltoids (Bahu Depan)", "Triceps"],
    equipmentSetup: [
      "Atur sudut kemiringan bangku (incline bench) sekitar 30 sampai 45 derajat (jangan terlalu tegak agar tidak dominan bahu).",
      "Pilih sepasang dumbbell yang beratnya sesuai dengan repetisi target."
    ],
    instructions: [
      "Duduk di bangku dengan dumbbell diletakkan di atas paha dekat lutut.",
      "Gunakan bantuan tendangan lutut satu per satu untuk membawa dumbbell ke posisi bahu sambil merebahkan badan ke bangku.",
      "Busungkan dada, kunci belikat ke belakang, dan posisikan telapak tangan menghadap ke depan atau sedikit diagonal (45 derajat).",
      "Dorong dumbbell ke atas hingga lengan lurus tapi jangan mengunci sendi siku secara berlebihan.",
      "Turunkan dumbbell perlahan hingga terasa regangan nyaman di otot dada bagian atas.",
      "Dorong kembali ke atas dengan mengontraksikan dada atas."
    ],
    dosAndDonts: {
      dos: [
        "Gunakan bantuan paha saat menaikkan dan menurunkan dumbbell untuk menghemat energi bahu.",
        "Jaga siku membentuk sudut sekitar 45-60 derajat dari tubuh."
      ],
      donts: [
        "Jangan mengatur sudut bangku lebih dari 60 derajat karena beban akan beralih ke bahu.",
        "Jangan membenturkan kedua dumbbell di atas (menghilangkan tensi otot)."
      ]
    },
    coachCues: {
      max: "Dada atas adalah kunci tampilan dada tebal & bidang bro! Rasain dorongan dari dada atas lo. Gas 4 set x 10 reps!",
      mia: "Dorong perlahan dan rasakan aktivasi otot dada bagian atas. Jaga punggung tetap stabil di sandaran ya! ✨"
    },
    recommendedSetsReps: "3-4 Set x 10-12 Repetisi (Rest 60-90s)",
    gifUrl: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Incline_Dumbbell_Press/0.jpg"
  },
  {
    id: "leg-press-machine",
    name: "45-Degree Leg Press Machine",
    indonesianName: "Mesin Leg Press 45 Derajat (Paha & Bokong)",
    aliases: ["leg press", "legpress", "mesin leg press", "alat dorong kaki", "alat paha", "leg press 45", "sled leg press"],
    equipmentCategory: "machine",
    equipmentName: "45-Degree Incline Leg Press Machine",
    bodyPart: "legs",
    targetMuscles: ["Quadriceps (Paha Depan)", "Gluteus Maximus (Bokong)"],
    secondaryMuscles: ["Hamstrings (Paha Belakang)", "Calves (Betis)"],
    equipmentSetup: [
      "Atur sudut sandaran punggung agar punggung bawah dan panggul menempel rata tanpa terangkat.",
      "Pasang pelat beban (weight plates) secara merata di kedua sisi pin penyangga.",
      "Pahami tuas pengunci keamanan (safety lock lever) di samping sebelum mulai mendorong."
    ],
    instructions: [
      "Duduk di mesin dengan punggung dan pinggul menempel rapat pada bantalan sandaran.",
      "Letakkan kedua kaki di platform selebar bahu di tengah-tengah platform, jari-jari kaki sedikit mengarah ke luar.",
      "Dorong platform ke atas hingga kaki lurus (JANGAN KUNCI MATI SENDI SIKU LUTUT).",
      "Lepaskan tuas safety lock di samping bangku dengan memutar handle ke luar.",
      "Turunkan platform perlahan dengan menekuk lutut hingga sudut sekitar 90 derajat (pastikan bokong tidak terangkat dari kursi).",
      "Dorong kembali platform ke atas menggunakan tumit dan telapak kaki hingga kembali ke posisi awal."
    ],
    dosAndDonts: {
      dos: [
        "Selalu dorong menggunakan tumpuan tumit dan tengah telapak kaki.",
        "Jaga lutut tetap sejajar dengan arah jari-jari kaki (jangan biarkan lutut masuk ke dalam / caving in).",
        "Kunci kembali tuas safety lock setelah menyelesaikan set."
      ],
      donts: [
        "SANGAT PENTING: JANGAN PERNAH MENGUNCI MATI LUTUT (LOCKOUT) DI ATAS (Sangat berbahaya untuk persendian lutut).",
        "Jangan biarkan punggung bawah atau bokong terangkat melengkung dari kursi (bisa mencederai tulang belakang)."
      ]
    },
    coachCues: {
      max: "AWAS bro: JANGAN LOCKOUT LUTUT lo pas di atas! Selalu sisakan sedikit tekukan lutut biar sendi lo aman. Push pake tumit!",
      mia: "Pastikan punggung dan pinggul selalu menempel nyaman di sandaran ya. Rasakan kekuatan di paha dan bokongmu! 💪"
    },
    recommendedSetsReps: "4 Set x 10-12 Repetisi (Rest 90-120s)",
    gifUrl: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Leg_Press/0.jpg"
  },
  {
    id: "seated-cable-row",
    name: "Seated Cable Row Machine",
    indonesianName: "Seated Cable Row (Dayung Kabel Duduk)",
    aliases: ["cable row", "seated cable row", "seated row", "mesin row", "dayung kabel", "low row", "mesin tarik perut"],
    equipmentCategory: "cable",
    equipmentName: "Seated Low Cable Row Station",
    bodyPart: "back",
    targetMuscles: ["Rhomboids", "Middle Trapezius", "Latissimus Dorsi"],
    secondaryMuscles: ["Biceps Brachii", "Rear Deltoids", "Erector Spinae"],
    equipmentSetup: [
      "Pasang handle V-Bar (close-grip) atau wide-grip attachment pada kabel bawah.",
      "Atur pin beban sesuai target repetisi.",
      "Pastikan pijakan kaki (footrests) kokoh dan tidak licin."
    ],
    instructions: [
      "Duduk di mesin dan letakkan kaki di pijakan kaki dengan lutut sedikit menekuk (tidak terkunci).",
      "Condongkan badan ke depan untuk meraih handle, lalu tarik kembali tubuh hingga tegak 90 derajat.",
      "Tarik handle ke arah pusar / perut bagian bawah sambil menarik siku ke belakang.",
      "Rapatkan belikat sekuat tenaga di akhir gerakan dan tahan selama 1 detik.",
      "Kembalikan lengan ke depan secara perlahan hingga otot punggung terasa meregang, dengan tubuh tetap stabil tegak."
    ],
    dosAndDonts: {
      dos: [
        "Jaga postur dada tetap tegak dan punggung lurus alami sepanjang gerakan.",
        "Tarik menggunakan otot punggung dan siku, bukan menarik dengan punggung bawah."
      ],
      donts: [
        "Jangan mengayunkan tubuh ke depan dan belakang secara agresif (hindari momentum).",
        "Jangan membungkukkan punggung saat merentangkan tangan ke depan."
      ]
    },
    coachCues: {
      max: "Tarik handle ke perut lo bro, squeeze belikat lo kayak lagi ngejepit koin di tengah punggung! Solid 4 set x 12 reps!",
      mia: "Jaga punggung tetap tegap dan rasakan kontraksi mantap di tengah punggung. Kontrol gerakannya perlahan ya. ✨"
    },
    recommendedSetsReps: "3-4 Set x 10-12 Repetisi (Rest 60s)",
    gifUrl: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Seated_Cable_Rows/0.jpg"
  },
  {
    id: "smith-machine-squat",
    name: "Smith Machine Squat",
    indonesianName: "Squat di Mesin Smith (Paha & Bokong Terpandu)",
    aliases: ["smith machine", "smith squat", "smith machine squat", "mesin smith", "alat squat rel", "alat smith"],
    equipmentCategory: "smith_machine",
    equipmentName: "Guided Smith Machine",
    bodyPart: "legs",
    targetMuscles: ["Quadriceps (Paha)", "Gluteus (Bokong)"],
    secondaryMuscles: ["Hamstrings", "Calves", "Core"],
    equipmentSetup: [
      "Atur stopper pengaman (safety catches) di kedua sisi rel pada ketinggian tepat di bawah posisi squat terendahmu.",
      "Atur ketinggian barbel di rel setinggi bahu bagian atas (mudah diangkat).",
      "Pasang pelat beban secara simetris di kedua sisi barbel."
    ],
    instructions: [
      "Posisikan tubuh di bawah barbel, letakkan barbel di atas otot trapezius (bukan di tulang leher).",
      "Posisikan kaki sedikit lebih maju ke depan dari garis barbel (sekitar 1-2 jengkal ke depan) selebar bahu.",
      "Buka kaitan barbel dengan memutar pergelangan tangan ke belakang.",
      "Turunkan pinggul ke bawah dan ke belakang seperti hendak duduk di kursi hingga paha sejajar lantai (90 derajat).",
      "Dorong kembali ke atas melalui tumit kaki hingga berdiri tegak."
    ],
    dosAndDonts: {
      dos: [
        "Manfaatkan lintasan rel Smith machine untuk fokus pada kontraksi paha dan bokong.",
        "Selalu putar pergelangan tangan untuk mengaitkan barbel kembali ke rel jika merasa lelah."
      ],
      donts: [
        "Jangan meletakkan kaki tepat di bawah barbel seperti free squat biasa (karena smith machine memiliki lintasan vertikal tetap).",
        "Jangan biarkan lutut terlipat ke dalam saat mendorong naik."
      ]
    },
    coachCues: {
      max: "Kaki agak maju dikit ke depan bro, biar pinggul lo bisa turun dalem tanpa neken lutut. Kunci paha lo pas naik!",
      mia: "Turun perlahan dan dorong kuat dari tumit. Mesin Smith sangat aman untuk melatih form squat yang rapi! ✨"
    },
    recommendedSetsReps: "4 Set x 10-12 Repetisi (Rest 90s)",
    gifUrl: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Smith_Machine_Squat/0.jpg"
  },
  {
    id: "pec-deck-fly",
    name: "Pec Deck / Butterfly Machine",
    indonesianName: "Mesin Pec Deck / Butterfly (Isolasi Dada)",
    aliases: ["pec deck", "pec deck machine", "butterfly machine", "mesin kupu-kupu", "alat fly dada", "machine chest fly", "pec fly"],
    equipmentCategory: "machine",
    equipmentName: "Pec Deck / Machine Fly",
    bodyPart: "chest",
    targetMuscles: ["Pectoralis Major (Otot Dada Sternal & Clavicular)"],
    secondaryMuscles: ["Anterior Deltoids"],
    equipmentSetup: [
      "Atur ketinggian kursi (seat height) sehingga pegangan atau bantalan lengan sejajar dengan bagian tengah dada saat duduk.",
      "Atur lengan tuas (range of motion lever) di bagian atas agar memberikan regangan dada yang nyaman tanpa membebani sendi bahu.",
      "Pilih pin beban ringan hingga sedang (karena ini gerakan isolasi murni)."
    ],
    instructions: [
      "Duduk tegak dengan punggung dan kepala menempel rapat di sandaran kursi.",
      "Raih pegangan atau letakkan lengan bawah pada bantalan dengan siku sedikit ditekuk.",
      "Busungkan dada, kunci belikat ke belakang.",
      "Tarik kedua lengan ke depan bersama-sama hingga bertemu di depan dada.",
      "Remas otot dada (squeeze) sekuat tenaga selama 1-2 detik di titik pertemuan.",
      "Buka kembali lengan perlahan hingga dada terasa meregang, lalu ulangi."
    ],
    dosAndDonts: {
      dos: [
        "Fokus pada merapatkan kedua siku/lengan ke depan untuk memeras otot dada.",
        "Pertahankan tekukan siku yang konstan sepanjang repetisi."
      ],
      donts: [
        "Jangan membuka tangan terlalu jauh ke belakang hingga bahu terasa sakit.",
        "Jangan membiarkan bahu maju ke depan (slouching) saat merapatkan lengan."
      ]
    },
    coachCues: {
      max: "Ini gerakan pamungkas buat bikin belahan dada tebel & sobek bro! Tahan 1 detik pas di depan, rasain panasnya! 🔥",
      mia: "Buka dada lebar-lebar dan rasakan kontraksi penuh saat menutup ke depan. Bagus banget untuk postur tegap! ✨"
    },
    recommendedSetsReps: "3-4 Set x 12-15 Repetisi (Rest 60s)",
    gifUrl: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Butterfly/0.jpg"
  },
  {
    id: "cable-tricep-pushdown",
    name: "Cable Tricep Rope Pushdown",
    indonesianName: "Cable Tricep Pushdown (Triceps Tali Kabel)",
    aliases: ["tricep pushdown", "cable pushdown", "tricep rope", "tricep cable", "dorong tricep", "alat kabel tricep"],
    equipmentCategory: "cable",
    equipmentName: "Cable Crossover / Functional Trainer",
    bodyPart: "arms",
    targetMuscles: ["Triceps Brachii (Lateral & Medial Heads)"],
    secondaryMuscles: ["Forearms"],
    equipmentSetup: [
      "Atur katrol kabel (cable pulley) di posisi paling atas.",
      "Pasang attachment tali tambang (rope attachment) atau straight bar.",
      "Pilih pin beban yang memungkinkan kontrol penuh tanpa mengayun tubuh."
    ],
    instructions: [
      "Berdiri menghadap kabel, condongkan tubuh sedikit ke depan di pinggul (sekitar 15 derajat).",
      "Genggam tali tambang, rapatkan kedua siku ke samping badan / pinggang.",
      "Dorong tali ke bawah hanya dengan menggerakkan lengan bawah hingga lengan lurus ke bawah.",
      "Buka tali ke arah samping luar di bagian bawah untuk kontraksi tricep maksimal.",
      "Tahan kontraksi selama 1 detik di bawah.",
      "Naikkan kembali lengan bawah perlahan hingga siku membentuk sudut 90 derajat (siku tetap terkunci di samping badan)."
    ],
    dosAndDonts: {
      dos: [
        "Kunci posisi siku agar tidak bergerak maju-mundur sepanjang gerakan.",
        "Buka ujung tali ke samping di posisi bawah untuk aktivasi kepala lateral tricep."
      ],
      donts: [
        "Jangan menggunakan momentum bahu atau menghentak tubuh ke bawah.",
        "Jangan membiarkan siku melebar ke samping atau melayang ke depan."
      ]
    },
    coachCues: {
      max: "Kunci siku lo nempel di pinggang bro! Yang gerak cuma lengan bawah. Pas di bawah, mekarin talinya ke samping biar tricep lo meledak! 💪",
      mia: "Pertahankan siku tetap diam di sisi tubuh ya. Rasakan lengan belakang kencang di setiap dorongan. ✨"
    },
    recommendedSetsReps: "3-4 Set x 12-15 Repetisi (Rest 45-60s)",
    gifUrl: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Triceps_Pushdown_-_Rope_Attachment/0.jpg"
  },
  {
    id: "barbell-bicep-curl",
    name: "Barbell Bicep Curl",
    indonesianName: "Barbell Bicep Curl (Lengan Bicep Barbel)",
    aliases: ["bicep curl", "barbell curl", "barbell bicep curl", "curl barbel", "alat angkat bicep", "ez bar curl"],
    equipmentCategory: "barbell",
    equipmentName: "EZ Curl Bar / Straight Barbell",
    bodyPart: "arms",
    targetMuscles: ["Biceps Brachii (Short & Long Heads)"],
    secondaryMuscles: ["Brachialis", "Brachioradialis (Lengan Bawah)"],
    equipmentSetup: [
      "Pilih EZ-bar (stang bergelombang) jika ingin kenyamanan pergelangan tangan, atau straight bar.",
      "Kunci pelat beban dengan safety clamp."
    ],
    instructions: [
      "Berdiri tegak dengan kaki selebar bahu, genggam barbel selebar bahu dengan telapak tangan menghadap ke atas (supinasi).",
      "Posisikan siku menempel dekat di samping tubuh.",
      "Tekuk siku dan angkat barbel ke atas menuju dada hanya dengan menggunakan kekuatan bicep.",
      "Kontraksikan bicep sekuat tenaga di puncak gerakan selama 1 detik.",
      "Turunkan barbel kembali secara perlahan ke posisi awal dengan kontrol penuh."
    ],
    dosAndDonts: {
      dos: [
        "Jaga tubuh tetap tegak dan stabil tanpa mengayunkan pinggang.",
        "Fokus pada rentang gerak penuh (full range of motion)."
      ],
      donts: [
        "Jangan mengayunkan punggung ke belakang untuk mengangkat beban berat (cheating curl).",
        "Jangan membiarkan siku melompat maju ke depan."
      ]
    },
    coachCues: {
      max: "Jangan goyang pinggang bro! Berdiri tegak kayak pohon, angkat pake tenaga bicep murni. Pump lengan lo sampai meletus! 🔥",
      mia: "Lakukan perlahan dan rasakan aktivasi otot lengan depan. Jaga postur tetap tegap dan rileks ya. ✨"
    },
    recommendedSetsReps: "3-4 Set x 10-12 Repetisi (Rest 60s)",
    gifUrl: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Curl/0.jpg"
  },
  {
    id: "push-up",
    name: "Standard Push-Up",
    indonesianName: "Push Up Standar (Dada, Bahu & Core)",
    aliases: ["push up", "pushup", "push-up", "push up lantai", "knee push up", "latihan push up"],
    equipmentCategory: "bodyweight",
    equipmentName: "Matras / Lantai (Tanpa Alat)",
    bodyPart: "chest",
    targetMuscles: ["Pectoralis Major (Dada)", "Triceps"],
    secondaryMuscles: ["Anterior Deltoids", "Core / Abdominals", "Serratus Anterior"],
    equipmentSetup: [
      "Siapkan matras olahraga atau permukaan lantai yang rata dan tidak licin."
    ],
    instructions: [
      "Posisikan tangan di lantai sedikit lebih lebar dari bahu, jari-jari mengarah ke depan.",
      "Rentangkan kaki ke belakang hingga tubuh membentuk satu garis lurus sempurna dari kepala hingga tumit (posisi high plank).",
      "Kencangkan otot perut (core), bokong (glutes), dan paha.",
      "Tarik napas dan turunkan tubuh secara terkontrol hingga dada hampir menyentuh lantai (sekitar 2-3 cm dari lantai), siku membentuk sudut 45 derajat dari tubuh.",
      "Buang napas dan dorong lantai sekuat tenaga kembali ke posisi awal."
    ],
    dosAndDonts: {
      dos: [
        "Jaga tubuh tetap lurus seperti papan kayu sepanjang repetisi.",
        "Jika belum kuat push up standar, gunakan variasi knee push-up (bertumpu pada lutut) atau incline push-up di bangku."
      ],
      donts: [
        "Jangan biarkan pinggul melorot ke bawah atau menungging terlalu tinggi ke atas.",
        "Jangan melebarkan siku 90 derajat sejajar bahu (bentuk T) karena bisa mencederai bahu."
      ]
    },
    coachCues: {
      max: "Kunci perut lo kenceng bro! Dada turun nyaris nyium lantai, dorong lantainya sekuat tenaga. Jangan setengah-setengah! 💪",
      mia: "Jaga tubuh tetap sejajar dan anggun. Jika terasa berat, boleh coba versi bertumpu di lutut dulu ya! ✨"
    },
    recommendedSetsReps: "3-4 Set x 12-15 Repetisi (Rest 60s)",
    gifUrl: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Pushups/0.jpg"
  },
  {
    id: "dumbbell-shoulder-press",
    name: "Seated Dumbbell Shoulder Press",
    indonesianName: "Dumbbell Shoulder Press (Bahu Depan & Samping)",
    aliases: ["shoulder press", "dumbbell shoulder press", "overhead press", "db shoulder press", "alat bahu", "press bahu"],
    equipmentCategory: "dumbbell",
    equipmentName: "Upright Bench & Dumbbells",
    bodyPart: "shoulders",
    targetMuscles: ["Anterior Deltoids (Bahu Depan)", "Lateral Deltoids (Bahu Samping)"],
    secondaryMuscles: ["Triceps", "Upper Trapezius"],
    equipmentSetup: [
      "Atur sandaran bangku hampir tegak (sekitar 75-85 derajat).",
      "Pilih dumbbell dengan berat yang bisa dikontrol dalam 10-12 repetisi."
    ],
    instructions: [
      "Duduk di bangku dengan dumbbell di atas paha.",
      "Gunakan lutut untuk membantu mengangkat dumbbell ke ketinggian bahu.",
      "Posisikan telapak tangan menghadap ke depan atau sedikit semi-netral, siku di bawah pergelangan tangan.",
      "Dorong dumbbell lurus ke atas kepala secara bersamaan hingga lengan hampir lurus.",
      "Turunkan kembali perlahan hingga dumbbell setinggi telinga / bahu, lalu dorong kembali."
    ],
    dosAndDonts: {
      dos: [
        "Punggung bawah tetap menempel kuat pada sandaran bangku.",
        "Kaki menapak kokoh di lantai untuk menjaga stabilitas."
      ],
      donts: [
        "Jangan melengkungkan punggung bawah secara berlebihan saat mendorong beban.",
        "Jangan membenturkan dumbbell di atas kepala."
      ]
    },
    coachCues: {
      max: "Bikin bahu lo bulet kayak buah kelapa bro! Dorong stabil ke atas, rasain deltoid lo kebakar! 🔥",
      mia: "Dorong ke atas dengan ritme yang tenang, jaga bahu tetap rileks dan jangan tegang di leher ya. ✨"
    },
    recommendedSetsReps: "3-4 Set x 10-12 Repetisi (Rest 75s)",
    gifUrl: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dumbbell_Shoulder_Press/0.jpg"
  },
  {
    id: "seated-leg-extension",
    name: "Seated Leg Extension Machine",
    indonesianName: "Mesin Leg Extension (Isolasi Paha Depan)",
    aliases: ["leg extension", "leg extension machine", "mesin paha depan", "alat tendang paha", "quad extension"],
    equipmentCategory: "machine",
    equipmentName: "Seated Leg Extension Machine",
    bodyPart: "legs",
    targetMuscles: ["Quadriceps (Paha Depan: Rectus Femoris & Vasto)"],
    secondaryMuscles: [],
    equipmentSetup: [
      "Atur sandaran punggung sehingga lutut berada tepat di garis poros putar mesin.",
      "Atur bantalan roller kaki agar bertumpu tepat di atas pergelangan kaki / tulang kering bawah.",
      "Pilih pin beban ringan-sedang."
    ],
    instructions: [
      "Duduk di mesin dan pegang handle samping kursi dengan kuat.",
      "Tendang / luruskan kaki ke atas hingga kaki lurus horizontal.",
      "Kencangkan (squeeze) otot paha depan sekuat tenaga di posisi atas selama 1-2 detik.",
      "Turunkan beban kembali perlahan hingga sudut 90 derajat tanpa membiarkan tumpukan beban saling membentur."
    ],
    dosAndDonts: {
      dos: [
        "Pegang handle samping untuk mengunci pinggul tetap menempel di kursi.",
        "Tahan 1 detik di posisi puncak untuk kontraksi quad maksimal."
      ],
      donts: [
        "Jangan menghentakkan beban dengan cepat menggunakan momentum.",
        "Hindari beban terlalu berat jika sedang mengalami cedera sendi tempurung lutut."
      ]
    },
    coachCues: {
      max: "Tahan 1-2 detik di atas bro! Rasain paha depan lo robek dan terdefinisi tajam. Jangan lepas handle samping!",
      mia: "Luruskan kaki perlahan dan rasakan otot paha depan bekerja optimal. Bagus sekali untuk kekuatan lutut! ✨"
    },
    recommendedSetsReps: "3-4 Set x 12-15 Repetisi (Rest 60s)",
    gifUrl: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Leg_Extensions/0.jpg"
  },
  {
    id: "lying-leg-curl",
    name: "Lying / Seated Leg Curl Machine",
    indonesianName: "Mesin Leg Curl (Paha Belakang / Hamstrings)",
    aliases: ["leg curl", "lying leg curl", "seated leg curl", "mesin paha belakang", "alat tekuk kaki", "hamstring curl"],
    equipmentCategory: "machine",
    equipmentName: "Lying Leg Curl Machine",
    bodyPart: "legs",
    targetMuscles: ["Hamstrings (Biceps Femoris, Semitendinosus)"],
    secondaryMuscles: ["Calves (Gastrocnemius)"],
    equipmentSetup: [
      "Atur bantalan kaki roller agar berada tepat di atas tumit (di belakang pergelangan kaki / tendon Achilles).",
      "Posisikan lutut sejajar dengan poros mesin saat berbaring."
    ],
    instructions: [
      "Berbaring tengkurap di mesin dan pegang handle samping erat-erat.",
      "Tekuk kedua kaki ke atas menuju bokong sejauh mungkin.",
      "Tahan kontraksi di titik puncak selama 1 detik.",
      "Turunkan kembali perlahan hingga kaki hampir lurus (jangan biarkan beban membentur)."
    ],
    dosAndDonts: {
      dos: [
        "Jaga pinggul tetap menempel pada bantalan saat menekuk kaki.",
        "Kontrol fase turun secara lambat (2-3 detik)."
      ],
      donts: [
        "Jangan mengangkat pinggul dari bangku untuk membantu menekuk kaki."
      ]
    },
    coachCues: {
      max: "Tekuk sampai deket bokong bro! Hamstring lo harus seimbang kuatnya sama quad biar lutut lo tahan banting!",
      mia: "Tarik tumit ke arah bokong dengan terkontrol dan rasakan paha belakangmu mengencang sempurna. ✨"
    },
    recommendedSetsReps: "3-4 Set x 12-15 Repetisi (Rest 60s)",
    gifUrl: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Lying_Leg_Curls/0.jpg"
  },
  {
    id: "lateral-raise",
    name: "Dumbbell Lateral Raise",
    indonesianName: "Dumbbell Lateral Raise (Bahu Samping)",
    aliases: ["lateral raise", "side raise", "dumbbell lateral raise", "bahu samping", "angkat dumble samping", "side lateral"],
    equipmentCategory: "dumbbell",
    equipmentName: "Dumbbells",
    bodyPart: "shoulders",
    targetMuscles: ["Lateral Deltoids (Bahu Bagian Samping)"],
    secondaryMuscles: ["Anterior & Posterior Deltoids", "Trapezius"],
    equipmentSetup: [
      "Pilih dumbbell ringan (biasanya 2-6 kg untuk pemula/menengah karena tuas pengungkit panjang)."
    ],
    instructions: [
      "Berdiri tegak dengan dumbbell di samping paha, siku sedikit ditekuk (sekitar 15 derajat) dan kunci posisi siku.",
      "Condongkan tubuh sedikit ke depan di pinggul (sekitar 5-10 derajat).",
      "Angkat kedua lengan ke samping hingga setinggi bahu (lengan sejajar lantai).",
      "Arahkan siku memimpin gerakan ke atas (seperti menuang air dari teko).",
      "Turunkan dumbbell perlahan ke posisi awal dengan kendali penuh."
    ],
    dosAndDonts: {
      dos: [
        "Pimpin gerakan dengan siku, bukan dengan tangan.",
        "Gunakan beban ringan dengan kontrol penuh."
      ],
      donts: [
        "Jangan mengayunkan badan atau melompat untuk mengangkat beban.",
        "Jangan mengangkat tangan melebihi tinggi bahu karena akan membebani leher/traps."
      ]
    },
    coachCues: {
      max: "Beban enteng aja bro! Angkat pake siku lo ke samping, rasain bahu samping lo kebakar habis! 4 set x 15 reps!",
      mia: "Angkat tangan anggun ke samping setinggi bahu. Gerakan ini kunci tampilan bahu jenjang dan estetik! ✨"
    },
    recommendedSetsReps: "4 Set x 12-15 Repetisi (Rest 45-60s)",
    gifUrl: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Side_Lateral_Raise/0.jpg"
  },
  {
    id: "cable-crossover-fly",
    name: "Cable Crossover / Chest Fly",
    indonesianName: "Cable Crossover (Kabel Dada)",
    aliases: ["cable crossover", "cable fly", "cable cross", "alat kabel dada", "kabel silang", "cable chest fly"],
    equipmentCategory: "cable",
    equipmentName: "Dual Adjustable Pulley / Cable Crossover",
    bodyPart: "chest",
    targetMuscles: ["Pectoralis Major"],
    secondaryMuscles: ["Anterior Deltoids"],
    equipmentSetup: [
      "Atur katrol di posisi tinggi (untuk fokus dada bawah/tengah) atau di posisi setinggi dada.",
      "Pasang single D-handle di kedua sisi."
    ],
    instructions: [
      "Pegang kedua handle, berdiri di tengah mesin, dan maju satu langkah ke depan dalam posisi staggered stance (satu kaki di depan).",
      "Condongkan tubuh sedikit ke depan, busungkan dada, dan buka tangan ke samping dengan siku sedikit melengkung.",
      "Tarik kedua handle ke depan dan ke bawah hingga bertemu di depan dada.",
      "Rapatkan dan remas otot dada selama 1 detik.",
      "Buka kembali tangan perlahan hingga dada meregang."
    ],
    dosAndDonts: {
      dos: [
        "Jaga siku tetap dalam sudut tekukan yang sama dari awal hingga akhir.",
        "Fokus pada kontraksi dada konstan yang disediakan oleh tarikan kabel."
      ],
      donts: [
        "Jangan mengubah gerakan menjadi menekan/press dengan siku melurus tiba-tiba."
      ]
    },
    coachCues: {
      max: "Kabel ngasih tensi tanpa henti bro! Rapatkan kedua tangan di depan dan remas dada lo sekuat tenaga!",
      mia: "Rasakan tarikan lembut tapi kuat dari kabel. Jaga tubuh tetap seimbang dan dada tegap ya! ✨"
    },
    recommendedSetsReps: "3-4 Set x 12-15 Repetisi (Rest 60s)",
    gifUrl: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Crossover/0.jpg"
  },
  {
    id: "treadmill",
    name: "Cardio Treadmill",
    indonesianName: "Treadmill (Jalan Incline / Lari Kardio)",
    aliases: ["treadmill", "mesin lari", "alat lari", "incline walk", "treadmil", "tread mill", "alat jalan"],
    equipmentCategory: "cardio",
    equipmentName: "Commercial Motorized Treadmill",
    bodyPart: "cardio",
    targetMuscles: ["Cardiovascular System (Jantung & Paru)", "Legs"],
    secondaryMuscles: ["Calves", "Glutes", "Hamstrings"],
    equipmentSetup: [
      "Selalu jepit klip pengaman (safety emergency clip) ke pakaian sebelum mulai.",
      "Mulai dengan tombol 'Quick Start' pada kecepatan rendah (Speed 2-3 km/jam)."
    ],
    instructions: [
      "Untuk Fat Loss Zona 2: Atur Incline (kemiringan) ke 8.0 - 12.0 dan Speed (kecepatan) ke 4.5 - 5.5 km/jam (jalan cepat menanjak).",
      "Pertahankan postur tubuh tegak alami tanpa berpegangan terlalu erat pada handle samping (ayunkan lengan alami).",
      "Lakukan selama 20 - 45 menit untuk pembakaran kalori optimal tanpa mengorbankan massa otot."
    ],
    dosAndDonts: {
      dos: [
        "Gunakan sepatu olahraga yang empuk dan menyerap hentakan.",
        "Jaga pernapasan tetap berirama teratur."
      ],
      donts: [
        "Jangan berpegangan erat sambil condong ke belakang saat incline tinggi (mengurangi efektivitas pembakaran kalori hingga 40%).",
        "Jangan melompat turun saat karpet treadmill masih berputar kencang."
      ]
    },
    coachCues: {
      max: "Incline walk 12-3-30 bro! Kemiringan 12, speed 4.5-5.0, 30 menit. Lemak lo rontok tanpa bikin dengkul sakit! 🔥",
      mia: "Jalan santai dengan kemiringan sangat nyaman untuk membakar kalori dan menjaga mood tetap segar sepanjang hari! ✨"
    },
    recommendedSetsReps: "20 - 45 Menit Incline Walk (Zona 2 Cardio)",
    gifUrl: "https://images.unsplash.com/photo-1576678927484-cc907957088c?w=600&auto=format&fit=crop&q=80"
  }
];

// Helper to find exercise by query / alias
export function findExerciseOrEquipment(query: string): ExerciseItem | null {
  if (!query) return null;
  const q = query.toLowerCase().trim();

  // 1. Direct match on ID or Name
  const directMatch = EXERCISE_DATABASE.find(
    (item) => item.id.toLowerCase() === q || item.name.toLowerCase() === q || item.indonesianName.toLowerCase() === q
  );
  if (directMatch) return directMatch;

  // 2. Alias exact match
  const aliasMatch = EXERCISE_DATABASE.find((item) =>
    item.aliases.some((alias) => q.includes(alias.toLowerCase()) || alias.toLowerCase().includes(q))
  );
  if (aliasMatch) return aliasMatch;

  // 3. Keyword token matching
  const tokens = q.split(/[\s,+/_-]+/).filter((t) => t.length > 2);
  let bestItem: ExerciseItem | null = null;
  let maxScore = 0;

  for (const item of EXERCISE_DATABASE) {
    let score = 0;
    const searchable = `${item.name} ${item.indonesianName} ${item.aliases.join(" ")} ${item.equipmentName} ${item.targetMuscles.join(" ")}`.toLowerCase();

    for (const token of tokens) {
      if (searchable.includes(token)) {
        score += 2;
      }
    }

    if (score > maxScore) {
      maxScore = score;
      bestItem = item;
    }
  }

  return maxScore >= 2 ? bestItem : null;
}

// Generate formatted WhatsApp guide string
export function formatWhatsAppExerciseGuide(exercise: ExerciseItem, persona: "max" | "mia" = "max"): { text: string; mediaUrl?: string } {
  const coachName = persona === "max" ? "Coach Max" : "Coach Mia";
  const coachCue = persona === "max" ? exercise.coachCues.max : exercise.coachCues.mia;

  const text =
    `🏋️‍♂️ *PANDUAN ALAT & LATIHAN: ${exercise.name.toUpperCase()}*\n` +
    `🇮🇩 *${exercise.indonesianName}*\n` +
    `--------------------------------------------------\n` +
    `🎯 *Target Otot*: ${exercise.targetMuscles.join(", ")}\n` +
    `⚙️ *Kategori Alat*: ${exercise.equipmentName}\n` +
    `⏱️ *Rekomendasi*: ${exercise.recommendedSetsReps}\n\n` +
    `🔧 *CARA SETTING ALAT*:\n` +
    exercise.equipmentSetup.map((step, idx) => `${idx + 1}. ${step}`).join("\n") +
    `\n\n📝 *CARA EKSEKUSI STEP-BY-STEP*:\n` +
    exercise.instructions.map((step, idx) => `${idx + 1}. ${step}`).join("\n") +
    `\n\n💡 *TIPS & FORM KUNCI*:\n` +
    exercise.dosAndDonts.dos.map((d) => `✔ ${d}`).join("\n") +
    (exercise.dosAndDonts.donts.length > 0 ? "\n" + exercise.dosAndDonts.donts.map((d) => `✖ ${d}`).join("\n") : "") +
    `\n\n💬 *${coachName}*:\n"${coachCue}"\n` +
    `\n🎬 *Animasi Visual Gerakan*: ${exercise.gifUrl}`;

  return {
    text,
    mediaUrl: exercise.gifUrl
  };
}
