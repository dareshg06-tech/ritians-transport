// Ritians Transport — Route & Stops master data
// Sourced from ritians-tracking.onrender.com (public schedule)

export interface Route {
  no: number;
  routeNo: string;
  routeName: string;
  timing: string;
  start: string;
}

export interface Stop {
  stop: string;
  time: string;
}

export const routes: Route[] = [
  { no:1,  routeNo:"R01",  routeName:"Ennore",            timing:"Boarding Points", start:"5.50 am" },
  { no:2,  routeNo:"R01A", routeName:"Tondiarpet",         timing:"Boarding Points", start:"6.17 am" },
  { no:3,  routeNo:"R01B", routeName:"Kasimedu",           timing:"Boarding Points", start:"6.15 am" },
  { no:4,  routeNo:"R02",  routeName:"Triplicane",         timing:"Boarding Points", start:"6.20 am" },
  { no:5,  routeNo:"R03",  routeName:"Choolai",            timing:"Boarding Points", start:"6.20 am" },
  { no:6,  routeNo:"R03A", routeName:"Collector Nagar",    timing:"Boarding Points", start:"6.50 am" },
  { no:7,  routeNo:"R03B", routeName:"Water Tank",         timing:"Boarding Points", start:"6.40 am" },
  { no:8,  routeNo:"R04",  routeName:"East Mogappair",     timing:"Boarding Points", start:"6.30 am" },
  { no:9,  routeNo:"R05",  routeName:"CIT Nagar",          timing:"Boarding Points", start:"6.10 am" },
  { no:10, routeNo:"R05A", routeName:"Loyola College",     timing:"Boarding Points", start:"6.40 am" },
  { no:11, routeNo:"R06",  routeName:"Chinmayanagar",      timing:"Boarding Points", start:"6.10 am" },
  { no:12, routeNo:"R07",  routeName:"Santhome",           timing:"Boarding Points", start:"6.10 am" },
  { no:13, routeNo:"R08",  routeName:"Kovilambakkam",      timing:"Boarding Points", start:"6.10 am" },
  { no:14, routeNo:"R08A", routeName:"Adambakkam",         timing:"Boarding Points", start:"6.30 am" },
  { no:15, routeNo:"R09",  routeName:"MKB Nagar",          timing:"Boarding Points", start:"6.00 am" },
  { no:16, routeNo:"R09A", routeName:"Perambur",           timing:"Boarding Points", start:"6.30 am" },
  { no:17, routeNo:"R10",  routeName:"Thachoor",           timing:"Boarding Points", start:"5.50 am" },
  { no:18, routeNo:"R11",  routeName:"Chengalpattu",       timing:"Boarding Points", start:"6.00 am" },
  { no:19, routeNo:"R11A", routeName:"Guduvanchery",       timing:"Boarding Points", start:"6.30 am" },
  { no:20, routeNo:"R12",  routeName:"Minjur",             timing:"Boarding Points", start:"5.45 am" },
  { no:21, routeNo:"R13",  routeName:"Vyasarpadi",         timing:"Boarding Points", start:"6.10 am" },
  { no:22, routeNo:"R13A", routeName:"ICF",                timing:"Boarding Points", start:"6.45 am" },
  { no:23, routeNo:"R14",  routeName:"Thiruvallur",        timing:"Boarding Points", start:"6.25 am" },
  { no:24, routeNo:"R14A", routeName:"Kakkalur",           timing:"Boarding Points", start:"6.55 am" },
  { no:25, routeNo:"R15",  routeName:"Kancheepuram",       timing:"Boarding Points", start:"6.00 am" },
  { no:26, routeNo:"R15A", routeName:"Orikkai",            timing:"Boarding Points", start:"6.15 am" },
  { no:27, routeNo:"R16",  routeName:"Neelangkarai",       timing:"Boarding Points", start:"6.10 am" },
  { no:28, routeNo:"R16A", routeName:"Guindy",             timing:"Boarding Points", start:"6.45 am" },
  { no:29, routeNo:"R16B", routeName:"Sholinganallur",     timing:"Boarding Points", start:"6.10 am" },
  { no:30, routeNo:"R17",  routeName:"Valluvarkottam",     timing:"Boarding Points", start:"6.15 am" },
  { no:31, routeNo:"R17A", routeName:"Valasaravakkam",     timing:"Boarding Points", start:"6.45 am" },
  { no:32, routeNo:"R18",  routeName:"Pallikaranai",       timing:"Boarding Points", start:"6.15 am" },
  { no:33, routeNo:"R18A", routeName:"Sembakkam",          timing:"Boarding Points", start:"6.25 am" },
  { no:34, routeNo:"R18B", routeName:"Kelambakkam",        timing:"Boarding Points", start:"6.00 am" },
  { no:35, routeNo:"R19",  routeName:"Poombukar",          timing:"Boarding Points", start:"6.10 am" },
  { no:36, routeNo:"R19A", routeName:"Vinayagapuram",      timing:"Boarding Points", start:"6.45 am" },
  { no:37, routeNo:"R20",  routeName:"Vepampattu",         timing:"Boarding Points", start:"6.30 am" },
  { no:38, routeNo:"R21",  routeName:"Ayyapakkam",         timing:"Boarding Points", start:"6.15 am" },
  { no:39, routeNo:"R22",  routeName:"Thiruthani",         timing:"Boarding Points", start:"5.55 am" },
  { no:40, routeNo:"R22A", routeName:"SR Gate",            timing:"Boarding Points", start:"6.30 am" },
  { no:41, routeNo:"R23",  routeName:"K4 Police Station",  timing:"Boarding Points", start:"6.35 am" },
  { no:42, routeNo:"R24",  routeName:"Arcot",              timing:"Boarding Points", start:"5.25 am" },
  { no:43, routeNo:"R25",  routeName:"Kallikuppam",        timing:"Boarding Points", start:"6.45 am" },
  { no:44, routeNo:"R25A", routeName:"Pudur",              timing:"Boarding Points", start:"6.45 am" },
  { no:45, routeNo:"R26",  routeName:"Andarkuppam",        timing:"Boarding Points", start:"6.35 am" },
  { no:46, routeNo:"R27",  routeName:"Avadi",              timing:"Boarding Points", start:"6.25 am" },
  { no:47, routeNo:"R27A", routeName:"Kollumedu",          timing:"Boarding Points", start:"6.30 am" },
  { no:48, routeNo:"R28",  routeName:"Agaram",             timing:"Boarding Points", start:"6.20 am" },
  { no:49, routeNo:"R29",  routeName:"Velachery",          timing:"Boarding Points", start:"6.10 am" },
  { no:50, routeNo:"R29A", routeName:"Pammal",             timing:"Boarding Points", start:"6.35 am" },
  { no:51, routeNo:"R29B", routeName:"Sivanthangal",       timing:"Boarding Points", start:"7.05 am" },
];

export const routeStops: Record<string, Stop[]> = {
  R01:[{stop:"Lift Gate",time:"5.50 am"},{stop:"Wimco Market",time:"5.55 am"},{stop:"Ajax",time:"6.00 am"},{stop:"Periyar Nagar",time:"6.03 am"},{stop:"Thiruvottiyur Market",time:"6.08 am"},{stop:"Theradi",time:"6.10 am"},{stop:"Ellaimman Koil",time:"6.12 am"},{stop:"Raja Kadai",time:"6.14 am"},{stop:"Toll Gate",time:"6.15 am"},{stop:"RIT Campus",time:"7.40 am"}],
  R01A:[{stop:"New Vannarpettai",time:"6.17 am"},{stop:"Apollo",time:"6.18 am"},{stop:"Tondiarpet",time:"6.19 am"},{stop:"Maharani",time:"6.21 am"},{stop:"Mint",time:"6.22 am"},{stop:"New Bus Stand Mint",time:"6.27 am"},{stop:"Thirupalli Street",time:"6.33 am"},{stop:"Aminjikarai",time:"7.00 am"},{stop:"Skywalk",time:"7.02 am"},{stop:"Arumbakkam",time:"7.07 am"},{stop:"Koyambedu Metro",time:"7.10 am"},{stop:"Vengaya Mandi",time:"7.16 am"},{stop:"Ration Stop (Nerkundram)",time:"7.20 am"},{stop:"Maduravoyal",time:"7.21 am"},{stop:"Maduravoyal Erikarai",time:"7.25 am"},{stop:"Vanagaram",time:"7.29 am"},{stop:"RIT Campus",time:"7.40 am"}],
  R01B:[{stop:"Kasimedu",time:"6.15 am"},{stop:"Kalmandapam",time:"6.21 am"},{stop:"Royapuram Bridge",time:"6.27 am"},{stop:"Beach Station",time:"6.30 am"},{stop:"Parry's",time:"6.34 am"},{stop:"Central",time:"6.37 am"},{stop:"Egmore",time:"6.40 am"},{stop:"Dasaprakash",time:"6.44 am"},{stop:"Ega Theatre",time:"6.48 am"},{stop:"Aminjikarai Market",time:"6.51 am"},{stop:"RIT Campus",time:"7.40 am"}],
  R02:[{stop:"Chintadripet (Post Office)",time:"6.20 am"},{stop:"D1 Police Station",time:"6.25 am"},{stop:"Triplicane Highway",time:"6.29 am"},{stop:"Ice House Police Station",time:"6.32 am"},{stop:"Meersahibpet Market",time:"6.35 am"},{stop:"Royapettah New College",time:"6.39 am"},{stop:"Sterling Road (Bharath Petrol Bunk)",time:"6.40 am"},{stop:"Choolaimedu Subway",time:"6.43 am"},{stop:"Choolaimedu Bus Stop",time:"6.45 am"},{stop:"Anna Arch",time:"6.50 am"},{stop:"Arumbakkam Panchaliamman Koil",time:"6.53 am"},{stop:"NSK",time:"6.55 am"},{stop:"Maduravoyal Murugan Store",time:"6.58 am"},{stop:"RIT Campus",time:"7.40 am"}],
  R03:[{stop:"Pulianthope",time:"6.20 am"},{stop:"Choolai Post Office",time:"6.25 am"},{stop:"Purasaivakkam Doveton",time:"6.30 am"},{stop:"Kellys Signal",time:"6.33 am"},{stop:"Water Tank Road Signal",time:"6.40 am"},{stop:"Kilpauk Garden",time:"6.45 am"},{stop:"Chinthamani",time:"6.50 am"},{stop:"Anna Nagar Roundtana",time:"6.55 am"},{stop:"Thirumangalam Blue Star",time:"6.57 am"},{stop:"VR Mall",time:"7.00 am"},{stop:"Maduravoyal Ration Shop",time:"7.10 am"},{stop:"RIT Campus",time:"7.40 am"}],
  R03A:[{stop:"Collector Nagar",time:"6.50 am"},{stop:"Golden Flat",time:"6.55 am"},{stop:"Mogappair West Depot",time:"7.00 am"},{stop:"Nolambur",time:"7.03 am"},{stop:"MGR University",time:"7.08 am"},{stop:"RIT Campus",time:"7.40 am"}],
  R03B:[{stop:"Gangaiamman Koil",time:"6.40 am"},{stop:"Madina Masjid",time:"6.43 am"},{stop:"New Avadi Road",time:"6.45 am"},{stop:"Chintamani",time:"6.50 am"},{stop:"Nalli Store",time:"6.58 am"},{stop:"Anna Nagar Metro",time:"7.05 am"},{stop:"Thirumangalam Metro",time:"7.10 am"},{stop:"Nerkundram",time:"7.15 am"},{stop:"Maduravoyal Ration Shop",time:"7.25 am"},{stop:"Maduravoyal Erikarai",time:"7.27 am"},{stop:"RIT Campus",time:"7.40 am"}],
  R04:[{stop:"JJ Nagar Police Station",time:"6.30 am"},{stop:"HDFC Bank",time:"6.32 am"},{stop:"IOB Bank",time:"6.35 am"},{stop:"7H Bus Depot",time:"6.40 am"},{stop:"Amutha School",time:"6.50 am"},{stop:"D.R. Super Market",time:"6.52 am"},{stop:"Nolambur",time:"6.55 am"},{stop:"Meadows Apartment",time:"6.57 am"},{stop:"MGR University",time:"7.00 am"},{stop:"RIT Campus",time:"7.40 am"}],
  R05:[{stop:"CIT Nagar",time:"6.10 am"},{stop:"Aranganathan Subway",time:"6.12 am"},{stop:"Srinivasa Theatre",time:"6.14 am"},{stop:"Mettupalayam",time:"6.16 am"},{stop:"Sangamam Hotel",time:"6.19 am"},{stop:"Arya Gowda Road",time:"6.24 am"},{stop:"Vivek",time:"6.29 am"},{stop:"Usman Road",time:"6.34 am"},{stop:"RIT Campus",time:"7.40 am"}],
  R05A:[{stop:"Loyola College",time:"6.40 am"},{stop:"Choolaimedu",time:"6.45 am"},{stop:"Metha Nagar",time:"6.49 am"},{stop:"NSK Nagar",time:"6.55 am"},{stop:"Arumbakkam (SBI Bank)",time:"7.00 am"},{stop:"MMDA Cholan Street",time:"7.05 am"},{stop:"MMDA Vallavan Hotel",time:"7.10 am"},{stop:"CMBT (Koyambedu)",time:"7.15 am"},{stop:"Rohini Theatre",time:"7.18 am"},{stop:"Nerkundram Vengaya Mandi",time:"7.22 am"},{stop:"Maduravoyal Erikarai",time:"7.25 am"},{stop:"RIT Campus",time:"7.40 am"}],
  R06:[{stop:"Chinmayanagar",time:"6.10 am"},{stop:"Sai Nagar",time:"6.12 am"},{stop:"Natesan Nagar",time:"6.13 am"},{stop:"Elango Nagar",time:"6.14 am"},{stop:"Virugampakkam",time:"6.17 am"},{stop:"KK Nagar",time:"6.20 am"},{stop:"KK Nagar ESI",time:"6.27 am"},{stop:"Ashok Pillar",time:"6.32 am"},{stop:"Kasi Theatre",time:"6.37 am"},{stop:"Ekkatuthangal",time:"6.42 am"},{stop:"Olympia",time:"6.43 am"},{stop:"Porur Saravana Stores",time:"6.55 am"},{stop:"RIT Campus",time:"7.40 am"}],
  R07:[{stop:"Mandaveli Bus Depot",time:"6.10 am"},{stop:"Pattinapakkam",time:"6.15 am"},{stop:"Kutchery Road",time:"6.20 am"},{stop:"Luz Corner",time:"6.25 am"},{stop:"P.S. Sivasamy Road",time:"6.27 am"},{stop:"SIET College",time:"6.32 am"},{stop:"Nandanam Signal",time:"6.37 am"},{stop:"Saidapet Veterinary Hospital",time:"6.42 am"},{stop:"Saidapet Bus Stop",time:"6.47 am"},{stop:"Guindy",time:"6.49 am"},{stop:"Butt Road",time:"6.55 am"},{stop:"Chennai Trade Centre",time:"7.10 am"},{stop:"Porur",time:"7.15 am"},{stop:"Ayyappanthangal",time:"7.18 am"},{stop:"RIT Campus",time:"7.40 am"}],
  R08:[{stop:"Kovilampakkam",time:"6.10 am"},{stop:"Keelkattalai Bus Stop",time:"6.12 am"},{stop:"Madipakkam UTI Bank",time:"6.15 am"},{stop:"Madipakkam Koot Road Bus Stop",time:"6.16 am"},{stop:"Ranga Theatre",time:"6.18 am"},{stop:"Nanganallur Chidambaram Stores",time:"6.20 am"},{stop:"Nanganallur Saravana Hotel",time:"6.22 am"},{stop:"Vanuvampet Church",time:"6.25 am"},{stop:"Surendhar Nagar Bus Stop",time:"6.27 am"},{stop:"Jayalakshmi Theatre",time:"6.29 am"},{stop:"Thillai Ganga Nagar Subway",time:"6.32 am"},{stop:"Aazar Khana Bus Stop",time:"6.35 am"},{stop:"Butt Road",time:"6.37 am"},{stop:"Ramavaram",time:"6.39 am"},{stop:"RIT Campus",time:"7.40 am"}],
  R08A:[{stop:"Seasons",time:"6.30 am"},{stop:"Kakkan Bridge",time:"6.33 am"},{stop:"Adambakkam Bus Depot",time:"6.35 am"},{stop:"St Thomas Mount",time:"6.38 am"},{stop:"Deepam Foods",time:"6.40 am"},{stop:"Maharaja Traders",time:"6.45 am"},{stop:"Vanuvampet Church",time:"6.50 am"},{stop:"Thillai Ganga Nagar Subway",time:"6.55 am"},{stop:"Butt Road",time:"7.00 am"},{stop:"Poonamallee",time:"7.35 am"},{stop:"RIT Campus",time:"7.40 am"}],
  R09:[{stop:"Vyasarpadi",time:"6.00 am"},{stop:"MKB Nagar",time:"6.05 am"},{stop:"E.B. Stop",time:"6.08 am"},{stop:"Kannadhasan Nagar",time:"6.10 am"},{stop:"M.R. Nagar",time:"6.13 am"},{stop:"Lakshmi Amman Nagar",time:"6.22 am"},{stop:"B.B. Road",time:"6.26 am"},{stop:"Perambur Market",time:"6.34 am"},{stop:"Agaram",time:"6.40 am"},{stop:"Peravalur Road",time:"6.42 am"},{stop:"RIT Campus",time:"7.40 am"}],
  R09A:[{stop:"BB Road",time:"6.30 am"},{stop:"Perambur Bus Stop",time:"6.35 am"},{stop:"Perambur Railway Station",time:"6.39 am"},{stop:"Perambur Church",time:"6.41 am"},{stop:"Sembium Police Station",time:"6.43 am"},{stop:"Gandhi Salai",time:"6.45 am"},{stop:"Venus Mall",time:"6.47 am"},{stop:"Retteri",time:"6.50 am"},{stop:"Senthil Nagar",time:"6.55 am"},{stop:"RIT Campus",time:"7.40 am"}],
  R10:[{stop:"Thachoor",time:"5.50 am"},{stop:"Panjetty",time:"5.52 am"},{stop:"Janappanchatram Bypass",time:"5.55 am"},{stop:"Karanodai Bypass",time:"5.58 am"},{stop:"Vijaya Nallur",time:"6.03 am"},{stop:"Toll Gate",time:"6.05 am"},{stop:"Padianallur",time:"6.07 am"},{stop:"Red Hills (GRT)",time:"6.10 am"},{stop:"Red Hills Market",time:"6.12 am"},{stop:"Kavangarai",time:"6.15 am"},{stop:"Puzhal Jail",time:"6.17 am"},{stop:"Puzhal Camp",time:"6.20 am"},{stop:"Velammal College",time:"6.25 am"},{stop:"RIT Campus",time:"7.40 am"}],
  R11:[{stop:"Chengalpattu Rattinakinaru",time:"6.00 am"},{stop:"New Bus Stand",time:"6.02 am"},{stop:"Old Bus Stand",time:"6.04 am"},{stop:"Chengalpattu Bypass",time:"6.07 am"},{stop:"SP Kovil",time:"6.18 am"},{stop:"MM Nagar Samiyar Gate",time:"6.23 am"},{stop:"MM Nagar Bus Stand",time:"6.28 am"},{stop:"Kattankulathur",time:"6.30 am"},{stop:"RIT Campus",time:"7.40 am"}],
  R11A:[{stop:"Guduvanchery",time:"6.30 am"},{stop:"Urapakkam",time:"6.35 am"},{stop:"Vandalur",time:"6.40 am"},{stop:"Perungalathur",time:"6.45 am"},{stop:"Vandalur Bridge",time:"6.55 am"},{stop:"Mannivakkam",time:"7.05 am"},{stop:"RIT Campus",time:"7.40 am"}],
  R12:[{stop:"Minjur Bus Stand",time:"5.45 am"},{stop:"Minjur Railway Station",time:"5.50 am"},{stop:"BDO Office",time:"5.52 am"},{stop:"Nandiyambakkam",time:"5.54 am"},{stop:"Pattamandiri",time:"6.00 am"},{stop:"Napalayam",time:"6.05 am"},{stop:"Manali Pudhu Nagar",time:"6.08 am"},{stop:"Manali Market",time:"6.15 am"},{stop:"MMDA 3rd Main Road",time:"6.18 am"},{stop:"Mathur",time:"6.22 am"},{stop:"Veterinary Hospital",time:"6.25 am"},{stop:"Madhavaram Milk Colony",time:"6.28 am"},{stop:"Arul Nagar",time:"6.30 am"},{stop:"Thapalpetti",time:"6.32 am"},{stop:"Moolakadai",time:"6.38 am"},{stop:"Kalpana Lamp",time:"6.45 am"},{stop:"Madhavaram Roundana",time:"6.47 am"},{stop:"RIT Campus",time:"7.40 am"}],
  R13:[{stop:"Ganeshapuram",time:"6.10 am"},{stop:"G3 Police Station",time:"6.15 am"},{stop:"Pattalam",time:"6.18 am"},{stop:"Otteri",time:"6.20 am"},{stop:"Podi Kadai",time:"6.23 am"},{stop:"T.B. Hospital",time:"6.25 am"},{stop:"Ayanavaram Signal",time:"6.27 am"},{stop:"Sayyani",time:"6.30 am"},{stop:"Ayanavaram Noor Hotel",time:"6.33 am"},{stop:"Joint Office",time:"6.35 am"},{stop:"Ayanavaram Railway Quarters",time:"6.37 am"},{stop:"RIT Campus",time:"7.40 am"}],
  R13A:[{stop:"ICF Signal",time:"6.45 am"},{stop:"Villivakkam Bus Stand",time:"6.50 am"},{stop:"Korattur Signal",time:"6.55 am"},{stop:"Nolambur Signal",time:"7.05 am"},{stop:"Vanagaram",time:"7.15 am"},{stop:"Velappanchavadi",time:"7.23 am"},{stop:"Poonamallee Bypass",time:"7.30 am"},{stop:"RIT Campus",time:"7.40 am"}],
  R14:[{stop:"Sevapetai",time:"6.25 am"},{stop:"Kakkalur",time:"6.30 am"},{stop:"Poonga Nagar",time:"6.35 am"},{stop:"GRT",time:"6.50 am"},{stop:"Manavalanagar Signal",time:"6.55 am"},{stop:"Manavalanagar Railway Station",time:"6.57 am"},{stop:"Putlur",time:"7.10 am"},{stop:"Aranvoyal",time:"7.15 am"},{stop:"Puthuchatram (India Japan Company)",time:"7.20 am"},{stop:"RIT Campus",time:"7.40 am"}],
  R14A:[{stop:"Kakkalur Signal",time:"6.55 am"},{stop:"SBI Bank",time:"6.58 am"},{stop:"Vellavedu",time:"7.20 am"},{stop:"Thirumazhisai",time:"7.25 am"},{stop:"RIT Campus",time:"7.40 am"}],
  R15:[{stop:"Ayyangarkulam",time:"6.00 am"},{stop:"Housing Board",time:"6.05 am"},{stop:"Collector Office",time:"6.07 am"},{stop:"Rangasamy Kulam",time:"6.15 am"},{stop:"RIT Campus",time:"7.40 am"}],
  R15A:[{stop:"Orikkai",time:"6.15 am"},{stop:"JJ Nagar",time:"6.17 am"},{stop:"Keerai Mandapam",time:"6.20 am"},{stop:"Tollgate",time:"6.23 am"},{stop:"Pachaiyappa's College",time:"6.30 am"},{stop:"Ayyampettai",time:"6.32 am"},{stop:"Rajampettai",time:"6.40 am"},{stop:"Walajabad",time:"6.50 am"},{stop:"Natha Nallur",time:"7.00 am"},{stop:"Panrutti",time:"7.03 am"},{stop:"Oragadam",time:"7.12 am"},{stop:"Arun Excello",time:"7.15 am"},{stop:"Sriperumbudur High School",time:"7.20 am"},{stop:"Sriperumbudur Tollgate",time:"7.25 am"},{stop:"Irungattukottai Bus Stand",time:"7.30 am"},{stop:"RIT Campus",time:"7.40 am"}],
  R16:[{stop:"Prathana Theatre",time:"6.10 am"},{stop:"Vetuvankeni",time:"6.15 am"},{stop:"Thiruvanmiyur RTO Office",time:"6.20 am"},{stop:"Adyar Depot",time:"6.29 am"},{stop:"Madhya Kailash",time:"6.35 am"},{stop:"Guindy",time:"6.42 am"},{stop:"Mugalivakkam",time:"6.55 am"},{stop:"Karayanchavadi",time:"7.10 am"},{stop:"Poonamallee Bus Stand",time:"7.15 am"},{stop:"RIT Campus",time:"7.40 am"}],
  R16A:[{stop:"Butt Road",time:"6.45 am"},{stop:"Nandambakkam",time:"6.48 am"},{stop:"Ramapuram Signal",time:"6.52 am"},{stop:"DLF",time:"6.55 am"},{stop:"Mugalivakkam",time:"7.00 am"},{stop:"Saravana Stores",time:"7.03 am"},{stop:"Poonamallee Depot",time:"7.25 am"},{stop:"RIT Campus",time:"7.40 am"}],
  R16B:[{stop:"Sholinganallur",time:"6.10 am"},{stop:"Karapakkam",time:"6.16 am"},{stop:"Karapakkam - TCS",time:"6.19 am"},{stop:"PTC (KFC)",time:"6.24 am"},{stop:"Mettukuppam",time:"6.26 am"},{stop:"Selaiyur",time:"6.56 am"},{stop:"MCC",time:"6.59 am"},{stop:"Kulakarai Street",time:"7.05 am"},{stop:"Krishna Nagar",time:"7.07 am"},{stop:"Bharathi Nagar",time:"7.08 am"},{stop:"Madanapuram",time:"7.13 am"},{stop:"Nazarathpettai",time:"7.34 am"},{stop:"RIT Campus",time:"7.40 am"}],
  R17:[{stop:"Valluvarkottam",time:"6.15 am"},{stop:"Liberty",time:"6.20 am"},{stop:"Power House",time:"6.25 am"},{stop:"Lakshman Sruthi",time:"6.30 am"},{stop:"Thai Sathya",time:"6.35 am"},{stop:"Virugampakkam",time:"6.40 am"},{stop:"Alwar Thirunagar",time:"6.42 am"},{stop:"RIT Campus",time:"7.40 am"}],
  R17A:[{stop:"Valasaravakkam Shivan Koil",time:"6.45 am"},{stop:"Valasaravakkam",time:"6.50 am"},{stop:"Saravana Bhavan Hotel",time:"6.53 am"},{stop:"Lakshmi Nagar",time:"6.55 am"},{stop:"Porur Bridge",time:"7.00 am"},{stop:"Iyyappanthangal",time:"7.05 am"},{stop:"Kattupakkam",time:"7.10 am"},{stop:"Kumanachavadi",time:"7.15 am"},{stop:"RIT Campus",time:"7.40 am"}],
  R18:[{stop:"Pallikaranai Munsif Office",time:"6.15 am"},{stop:"Medavakkam Junction",time:"6.20 am"},{stop:"Perumbakkam",time:"6.25 am"},{stop:"Madambakkam",time:"6.30 am"},{stop:"Selaiyur",time:"6.35 am"},{stop:"RIT Campus",time:"7.40 am"}],
  R18A:[{stop:"Sembakkam",time:"6.25 am"},{stop:"Kamarajapuram",time:"6.30 am"},{stop:"Rajakilpakkam Signal",time:"6.32 am"},{stop:"Camp Road",time:"6.35 am"},{stop:"Tambaram Sanatorium",time:"6.50 am"},{stop:"Chrompet",time:"6.55 am"},{stop:"Thiruneermalai",time:"7.00 am"},{stop:"RIT Campus",time:"7.40 am"}],
  R18B:[{stop:"Kelambakkam - GH",time:"6.00 am"},{stop:"Pudupakkam",time:"6.10 am"},{stop:"Mambakkam (Samathuvapuram)",time:"6.15 am"},{stop:"Mambakkam Kulam",time:"6.25 am"},{stop:"Ponmar",time:"6.30 am"},{stop:"Sithalapakkam",time:"6.35 am"},{stop:"Private Parking",time:"6.45 am"},{stop:"Santhosapuram",time:"6.50 am"},{stop:"Kamarajapuram",time:"7.00 am"},{stop:"Kishkinta Kulam",time:"7.15 am"},{stop:"Old Perungalathur",time:"7.20 am"},{stop:"Mudichur Bypass",time:"7.25 am"},{stop:"RIT Campus",time:"7.40 am"}],
  R19:[{stop:"Poombukar",time:"6.10 am"},{stop:"Ganga Cinema",time:"6.25 am"},{stop:"Don Bosco",time:"6.28 am"},{stop:"Poombukar (Second Stop)",time:"6.30 am"},{stop:"Korattur Bus Stop",time:"6.55 am"},{stop:"Padi Britania",time:"6.58 am"},{stop:"TVS Show Room",time:"7.10 am"},{stop:"Ambattur",time:"7.12 am"},{stop:"RIT Campus",time:"7.40 am"}],
  R19A:[{stop:"Vinayagapuram Bus Stand",time:"6.45 am"},{stop:"Retteri RTO Office",time:"6.55 am"},{stop:"Retteri",time:"6.58 am"},{stop:"Senthil Nagar",time:"7.00 am"},{stop:"RIT Campus",time:"7.40 am"}],
  R20:[{stop:"Vepampattu Railway Station",time:"6.30 am"},{stop:"Madha Kovil",time:"6.32 am"},{stop:"Eswar Nagar",time:"6.33 am"},{stop:"Indian Bank Thiruninravur",time:"6.35 am"},{stop:"Thiruninravur Railway Station",time:"6.36 am"},{stop:"Thiruninravur Bridge",time:"6.37 am"},{stop:"Jaya College",time:"6.39 am"},{stop:"Nemilicherri Road",time:"6.40 am"},{stop:"Pattabiram Gandhi Nagar",time:"6.41 am"},{stop:"Pattabiram Vasantha Mandapam",time:"6.42 am"},{stop:"Sekkadu Bus Stand",time:"6.45 am"},{stop:"Avadi Ponnu Store",time:"6.50 am"},{stop:"Avadi J.P. Garden",time:"6.52 am"},{stop:"Govarthanagiri Bus Stand",time:"6.55 am"},{stop:"Chennirkuppam",time:"7.05 am"},{stop:"RIT Campus",time:"7.40 am"}],
  R21:[{stop:"Ayappakkam Parking",time:"6.15 am"},{stop:"Ayappakkam SBI ATM",time:"6.17 am"},{stop:"Ayappakkam Petrol Bunk",time:"6.20 am"},{stop:"ICF Church",time:"6.22 am"},{stop:"Canara Bank",time:"6.27 am"},{stop:"Singapore Shopping",time:"6.32 am"},{stop:"Senneerkuppam",time:"7.05 am"},{stop:"RIT Campus",time:"7.40 am"}],
  R22:[{stop:"Thiruthani Bypass",time:"5.55 am"},{stop:"Thiruvallur Bypass X Road",time:"6.00 am"},{stop:"Nagalamman Nagar",time:"6.08 am"},{stop:"Krishna Poly",time:"6.10 am"},{stop:"Jothi Nagar",time:"6.12 am"},{stop:"Indira Gandhi Nagar",time:"6.15 am"},{stop:"Swalpet",time:"6.16 am"},{stop:"Government Hospital",time:"6.17 am"},{stop:"Old Bus Stand",time:"6.18 am"},{stop:"Railway Station",time:"6.20 am"},{stop:"New Bus Stand",time:"6.22 am"},{stop:"Navy Gate",time:"6.30 am"},{stop:"Venkatesapuram",time:"6.31 am"},{stop:"RIT Campus",time:"7.40 am"}],
  R22A:[{stop:"SR Gate",time:"6.30 am"},{stop:"Thakkolam Koot Road",time:"6.40 am"},{stop:"Thakkolam",time:"6.44 am"},{stop:"Marimangalam",time:"6.50 am"},{stop:"Narasimapuram",time:"6.55 am"},{stop:"Perambakkam",time:"7.05 am"},{stop:"Koovam Bus Stop",time:"7.08 am"},{stop:"RIT Campus",time:"7.40 am"}],
  R23:[{stop:"Nathamuni Theatre",time:"6.35 am"},{stop:"K4 Police Station",time:"6.40 am"},{stop:"Labour Officers Quarters",time:"6.42 am"},{stop:"Vijaya Maruthi (Nuts & Spices)",time:"6.44 am"},{stop:"Udayam Colony",time:"6.46 am"},{stop:"Kambar Colony",time:"6.48 am"},{stop:"Anna Nagar West Depot",time:"6.50 am"},{stop:"Thirumangalam Bridge",time:"6.52 am"},{stop:"Thirumangalam Waves",time:"6.56 am"},{stop:"RIT Campus",time:"7.40 am"}],
  R24:[{stop:"Arcot Bus Stand",time:"5.25 am"},{stop:"Muthukadai",time:"5.30 am"},{stop:"VC Motor",time:"5.33 am"},{stop:"Walajapettai",time:"5.35 am"},{stop:"Arignar Anna Government College",time:"5.37 am"},{stop:"Walajapettai Toll Gate",time:"5.40 am"},{stop:"Kaveripakkam",time:"5.45 am"},{stop:"Perumpullipakkam",time:"6.00 am"},{stop:"Vinayagapuram (KPM)",time:"6.20 am"},{stop:"Olimugamathu Pettai (Gori)",time:"6.22 am"},{stop:"Egambaranathar Koil",time:"6.25 am"},{stop:"Kachapeswarar Koil",time:"6.28 am"},{stop:"Pookadai Chatram",time:"6.32 am"},{stop:"Kammal Street",time:"6.35 am"},{stop:"Indra Nagar (KPM Railway Gate)",time:"6.37 am"},{stop:"Ponnerikarai",time:"6.40 am"},{stop:"Santhavellore",time:"7.05 am"},{stop:"Sungawarchathram",time:"7.10 am"},{stop:"Vadamangalam",time:"7.20 am"},{stop:"RIT Campus",time:"7.40 am"}],
  R25:[{stop:"Kallikuppam",time:"6.45 am"},{stop:"Stedford Hospital",time:"6.50 am"},{stop:"Saraswathy Nagar Indian Oil Petrol Bunk",time:"6.54 am"},{stop:"Manigandapuram",time:"6.56 am"},{stop:"Thirumullaivoyal Junction",time:"6.58 am"},{stop:"Vaishnavi Nagar",time:"7.00 am"},{stop:"Murugappa Polytechnic",time:"7.02 am"},{stop:"RIT Campus",time:"7.40 am"}],
  R25A:[{stop:"Pudur",time:"6.45 am"},{stop:"Oragadam HP Pump",time:"6.47 am"},{stop:"PTR Mahal",time:"6.50 am"},{stop:"Ponnu Supermarket",time:"6.53 am"},{stop:"Govardhanagiri",time:"7.15 am"},{stop:"RIT Campus",time:"7.40 am"}],
  R26:[{stop:"Andarkuppam",time:"6.35 am"},{stop:"Kundrathur",time:"6.40 am"},{stop:"Kundrathur Thandalam",time:"6.43 am"},{stop:"Kovur",time:"6.45 am"},{stop:"Gerugambakkam",time:"6.50 am"},{stop:"Bai Kadai",time:"6.53 am"},{stop:"Mathanandapuram",time:"6.55 am"},{stop:"Venkateswara Nagar",time:"6.58 am"},{stop:"Porur",time:"7.05 am"},{stop:"RIT Campus",time:"7.40 am"}],
  R27:[{stop:"Ajeya Stadium",time:"6.25 am"},{stop:"HVF",time:"6.28 am"},{stop:"CRP",time:"6.32 am"},{stop:"Mitnamalli",time:"6.35 am"},{stop:"Muthapudupet",time:"6.40 am"},{stop:"Sasthri Nagar",time:"6.45 am"},{stop:"Avadi Checkpost",time:"6.55 am"},{stop:"Rama Rathna Theatre",time:"7.06 am"},{stop:"Avadi Mankoil",time:"7.10 am"},{stop:"Vasantham Nagar",time:"7.12 am"},{stop:"Kovarthanagiri",time:"7.14 am"},{stop:"Kendra Vihar",time:"7.15 am"},{stop:"Kaduveti",time:"7.17 am"},{stop:"RIT Campus",time:"7.40 am"}],
  R27A:[{stop:"Kollumedu",time:"6.30 am"},{stop:"Vel Tech College",time:"6.40 am"},{stop:"Kovilpathagai",time:"6.45 am"},{stop:"Ajeya Stadium",time:"6.50 am"},{stop:"CRPF",time:"6.55 am"},{stop:"Mittanemili",time:"7.00 am"},{stop:"Palavedu Service Road",time:"7.10 am"},{stop:"Nemilichery Tollgate",time:"7.15 am"},{stop:"Chithukadu Blue",time:"7.25 am"},{stop:"Panimalar Tollgate",time:"7.30 am"},{stop:"Chembarambakkam",time:"7.37 am"},{stop:"RIT Campus",time:"7.40 am"}],
  R28:[{stop:"Agaram",time:"6.20 am"},{stop:"Periyar Nagar",time:"6.22 am"},{stop:"Thiruvalluvar Thirumanamandapam",time:"6.24 am"},{stop:"Perumal Koil",time:"6.26 am"},{stop:"Kamban Nagar",time:"6.28 am"},{stop:"E.B",time:"6.30 am"},{stop:"Shanmugam Mahal",time:"6.32 am"},{stop:"Senthil Nagar",time:"6.35 am"},{stop:"Thathankuppam",time:"6.38 am"},{stop:"Kalyan Jewellers",time:"6.45 am"},{stop:"Collector Nagar",time:"6.47 am"},{stop:"Cheriyan Hospital",time:"6.48 am"},{stop:"Golden Flats",time:"6.50 am"},{stop:"RIT Campus",time:"7.40 am"}],
  R29:[{stop:"Vijayanagar Bus Stand",time:"6.10 am"},{stop:"Kaiveli",time:"6.15 am"},{stop:"Kamachi Hospital",time:"6.17 am"},{stop:"Pallavaram Singapore Shopping",time:"6.30 am"},{stop:"Krishna Nagar",time:"6.33 am"},{stop:"RIT Campus",time:"7.40 am"}],
  R29A:[{stop:"Pammal",time:"6.35 am"},{stop:"Arunmathi Theatre",time:"6.37 am"},{stop:"Anagaputhur",time:"6.39 am"},{stop:"Manikandan Nagar",time:"6.41 am"},{stop:"Karima Nagar",time:"6.45 am"},{stop:"Kundrathur (Theradi)",time:"6.48 am"},{stop:"RIT Campus",time:"7.40 am"}],
  R29B:[{stop:"Sivanthangal",time:"7.05 am"},{stop:"Muthukumaran College",time:"7.10 am"},{stop:"Pattu Koot Road",time:"7.13 am"},{stop:"Mangadu",time:"7.15 am"},{stop:"Kankaiyamman Kovil",time:"7.20 am"},{stop:"MGR Nagar",time:"7.23 am"},{stop:"Kumananchavadi",time:"7.25 am"},{stop:"Aravind Hospital",time:"7.30 am"},{stop:"RIT Campus",time:"7.40 am"}],
};

export const parkingLocations = [
  "In front of green building",
  "In front of A block entrance",
  "Near to main entrance",
  "In front of placement banner",
  "In front of C block",
  "In front of hut",
  "Near to the ground",
  "Near to the astronaut statue",
  "In front of B block North",
  "In front of B block South",
  "Other",
];

// ── Time helpers ──
export function parseTime(t: string): number {
  if (!t) return 0;
  const [tp, mp] = t.trim().split(/\s+/);
  const m = (mp || "").toLowerCase();
  const [h, mn] = tp.split(".");
  let hr = parseInt(h);
  const mi = parseInt(mn || "0");
  if (m === "pm" && hr !== 12) hr += 12;
  if (m === "am" && hr === 12) hr = 0;
  return hr * 60 + mi;
}

export function timeCat(min: number): "early" | "normal" | "late" {
  if (min < 360) return "early";
  if (min <= 390) return "normal";
  return "late";
}

export function isToday(ts: number): boolean {
  if (!ts) return false;
  const d = new Date(ts);
  const n = new Date();
  return d.getDate() === n.getDate() && d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
}
