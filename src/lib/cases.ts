export type Pool = 'active' | 'rare' | 'discontinued'
export type RareType = 'Knife' | 'Gloves'

export interface CaseRecord {
  id: string
  name: string
  released: string // YYYY-MM-DD
  pool: Pool
  rare: RareType
  hasGloves: boolean
  notable: string
}

export const POOL_RANK: Record<Pool, number> = {
  discontinued: 0,
  rare: 1,
  active: 2,
}

export const CASE_DB: CaseRecord[] = [
  // ACTIVE DROP POOL
  { id: 'fracture',                name: 'Fracture Case',                  released: '2020-08-06', pool: 'active',       rare: 'Knife',  hasGloves: false, notable: 'AK Legion of Anubis' },
  { id: 'dreams_nightmares',       name: 'Dreams & Nightmares Case',       released: '2022-01-20', pool: 'active',       rare: 'Knife',  hasGloves: false, notable: 'Community designed, AK Nightwish' },
  { id: 'recoil',                  name: 'Recoil Case',                    released: '2022-07-01', pool: 'active',       rare: 'Knife',  hasGloves: false, notable: 'AK Ice Coaled, AWP Chromatic' },
  { id: 'revolution',              name: 'Revolution Case',                released: '2023-02-09', pool: 'active',       rare: 'Knife',  hasGloves: false, notable: 'AK Head Shot, M4A4 Temukau' },
  { id: 'kilowatt',                name: 'Kilowatt Case',                  released: '2024-02-06', pool: 'active',       rare: 'Knife',  hasGloves: false, notable: 'First CS2 case, Kukri knife' },
  { id: 'gallery',                 name: 'Gallery Case',                   released: '2024-08-22', pool: 'active',       rare: 'Knife',  hasGloves: false, notable: 'AK Inheritance, AWP Chrome Cannon' },
  { id: 'fever',                   name: 'Fever Case',                     released: '2025-03-13', pool: 'active',       rare: 'Knife',  hasGloves: false, notable: 'M4A1-S Vaporwave' },

  // RARE DROP POOL
  { id: 'snakebite',               name: 'Snakebite Case',                 released: '2021-05-03', pool: 'rare',         rare: 'Gloves', hasGloves: true,  notable: 'Glove case, M4A4 In Living Color' },
  { id: 'clutch',                  name: 'Clutch Case',                    released: '2018-02-15', pool: 'rare',         rare: 'Gloves', hasGloves: true,  notable: 'First glove case' },

  // DISCONTINUED
  { id: 'csgo_weapon',             name: 'CS:GO Weapon Case',              released: '2013-08-14', pool: 'discontinued', rare: 'Knife',  hasGloves: false, notable: 'FIRST CASE EVER. Holy grail.' },
  { id: 'csgo_weapon_2',           name: 'CS:GO Weapon Case 2',            released: '2013-11-08', pool: 'discontinued', rare: 'Knife',  hasGloves: false, notable: 'Second case ever, extremely rare' },
  { id: 'csgo_weapon_3',           name: 'CS:GO Weapon Case 3',            released: '2014-02-12', pool: 'discontinued', rare: 'Knife',  hasGloves: false, notable: 'Third case, only pistol skins' },
  { id: 'esports_2013',            name: 'eSports 2013 Case',              released: '2013-08-14', pool: 'discontinued', rare: 'Knife',  hasGloves: false, notable: 'First esports case, AWP BOOM' },
  { id: 'winter_offensive',        name: 'Winter Offensive Weapon Case',   released: '2013-12-18', pool: 'discontinued', rare: 'Knife',  hasGloves: false, notable: 'AWP Electric Hive' },
  { id: 'operation_bravo',         name: 'Operation Bravo Case',           released: '2013-09-19', pool: 'discontinued', rare: 'Knife',  hasGloves: false, notable: 'First operation case, AK Fire Serpent' },
  { id: 'operation_phoenix',       name: 'Operation Phoenix Weapon Case',  released: '2014-02-20', pool: 'discontinued', rare: 'Knife',  hasGloves: false, notable: 'AWP Asiimov debut' },
  { id: 'huntsman',                name: 'Huntsman Weapon Case',           released: '2014-05-01', pool: 'discontinued', rare: 'Knife',  hasGloves: false, notable: 'Huntsman knife introduced' },
  { id: 'operation_breakout',      name: 'Operation Breakout Weapon Case', released: '2014-07-01', pool: 'discontinued', rare: 'Knife',  hasGloves: false, notable: 'Butterfly knife, M4A1-S Cyrex' },
  { id: 'esports_2014_summer',     name: 'eSports 2014 Summer Case',       released: '2014-07-10', pool: 'discontinued', rare: 'Knife',  hasGloves: false, notable: 'AWP Corticera' },
  { id: 'operation_vanguard',      name: 'Operation Vanguard Weapon Case', released: '2014-11-11', pool: 'discontinued', rare: 'Knife',  hasGloves: false, notable: 'AK Wasteland Rebel' },
  { id: 'chroma',                  name: 'Chroma Case',                    released: '2015-01-08', pool: 'discontinued', rare: 'Knife',  hasGloves: false, notable: 'AWP Man-o-war, M4A4 Dragon King' },
  { id: 'chroma_2',                name: 'Chroma 2 Case',                  released: '2015-04-15', pool: 'discontinued', rare: 'Knife',  hasGloves: false, notable: 'M4A1-S Hyper Beast' },
  { id: 'chroma_3',                name: 'Chroma 3 Case',                  released: '2016-04-27', pool: 'discontinued', rare: 'Knife',  hasGloves: false, notable: "M4A1-S Chantico's Fire" },
  { id: 'falchion',                name: 'Falchion Case',                  released: '2015-05-26', pool: 'discontinued', rare: 'Knife',  hasGloves: false, notable: 'Falchion knife, AWP Hyper Beast' },
  { id: 'shadow',                  name: 'Shadow Case',                    released: '2015-09-17', pool: 'discontinued', rare: 'Knife',  hasGloves: false, notable: 'Shadow daggers, USP-S Kill Confirmed' },
  { id: 'revolver',                name: 'Revolver Case',                  released: '2015-12-08', pool: 'discontinued', rare: 'Knife',  hasGloves: false, notable: 'AK Point Disarray' },
  { id: 'operation_wildfire',      name: 'Operation Wildfire Case',        released: '2016-02-17', pool: 'discontinued', rare: 'Knife',  hasGloves: false, notable: 'Bowie knife, AK Fuel Injector' },
  { id: 'gamma',                   name: 'Gamma Case',                     released: '2016-06-15', pool: 'discontinued', rare: 'Knife',  hasGloves: false, notable: 'AWP Phobos, M4A1-S Mecha' },
  { id: 'gamma_2',                 name: 'Gamma 2 Case',                   released: '2016-08-18', pool: 'discontinued', rare: 'Knife',  hasGloves: false, notable: 'AK Neon Revolution' },
  { id: 'glove',                   name: 'Glove Case',                     released: '2016-11-28', pool: 'discontinued', rare: 'Gloves', hasGloves: true,  notable: 'FIRST GLOVE CASE. Premium tier.' },
  { id: 'spectrum',                name: 'Spectrum Case',                  released: '2017-03-15', pool: 'discontinued', rare: 'Knife',  hasGloves: false, notable: 'AK Bloodsport, USP Neo-Noir' },
  { id: 'operation_hydra',         name: 'Operation Hydra Case',           released: '2017-05-23', pool: 'discontinued', rare: 'Gloves', hasGloves: true,  notable: 'AWP Oni Taiji, glove case' },
  { id: 'spectrum_2',              name: 'Spectrum 2 Case',                released: '2017-09-14', pool: 'discontinued', rare: 'Knife',  hasGloves: false, notable: 'AK The Empress' },
  { id: 'cs20',                    name: 'CS20 Case',                      released: '2019-10-18', pool: 'discontinued', rare: 'Knife',  hasGloves: false, notable: 'Classic knife, FAMAS Commemoration' },
  { id: 'danger_zone',             name: 'Danger Zone Case',               released: '2018-12-06', pool: 'discontinued', rare: 'Knife',  hasGloves: false, notable: 'AWP Neo-Noir, AK Asiimov' },
  { id: 'horizon',                 name: 'Horizon Case',                   released: '2018-07-31', pool: 'discontinued', rare: 'Knife',  hasGloves: false, notable: 'Stiletto/Talon/Ursus/Navaja debut' },
  { id: 'prisma',                  name: 'Prisma Case',                    released: '2019-03-13', pool: 'discontinued', rare: 'Knife',  hasGloves: false, notable: 'AWP Atheris, AK Uncharted' },
  { id: 'prisma_2',                name: 'Prisma 2 Case',                  released: '2020-03-31', pool: 'discontinued', rare: 'Knife',  hasGloves: false, notable: 'AK Phantom Disruptor' },
  { id: 'shattered_web',           name: 'Shattered Web Case',             released: '2019-11-18', pool: 'discontinued', rare: 'Knife',  hasGloves: false, notable: 'Skeleton/Nomad/Survival knives' },
  { id: 'operation_riptide',       name: 'Operation Riptide Case',         released: '2021-09-22', pool: 'discontinued', rare: 'Knife',  hasGloves: false, notable: 'AK Leet Museo, AWP Big Game' },
  { id: 'operation_broken_fang',   name: 'Operation Broken Fang Case',     released: '2020-12-03', pool: 'discontinued', rare: 'Gloves', hasGloves: true,  notable: 'AK Slate, M4A1-S Printstream' },
]

export const DEMO_PRICES: Record<string, { lowest: number; median: number; volume: number }> = {
  fracture: { lowest: 0.32, median: 0.34, volume: 18500 },
  dreams_nightmares: { lowest: 0.42, median: 0.45, volume: 14200 },
  recoil: { lowest: 0.38, median: 0.41, volume: 16800 },
  revolution: { lowest: 0.46, median: 0.49, volume: 11900 },
  kilowatt: { lowest: 0.52, median: 0.56, volume: 22400 },
  gallery: { lowest: 0.78, median: 0.82, volume: 19800 },
  fever: { lowest: 0.91, median: 0.95, volume: 24600 },
  snakebite: { lowest: 1.45, median: 1.52, volume: 5400 },
  clutch: { lowest: 4.85, median: 5.02, volume: 1850 },
  csgo_weapon: { lowest: 745, median: 780, volume: 8 },
  csgo_weapon_2: { lowest: 312, median: 325, volume: 18 },
  csgo_weapon_3: { lowest: 142, median: 148, volume: 32 },
  esports_2013: { lowest: 8.95, median: 9.4, volume: 142 },
  winter_offensive: { lowest: 22.5, median: 23.8, volume: 64 },
  operation_bravo: { lowest: 165, median: 172, volume: 28 },
  operation_phoenix: { lowest: 11.2, median: 11.85, volume: 96 },
  huntsman: { lowest: 8.4, median: 8.8, volume: 184 },
  operation_breakout: { lowest: 12.6, median: 13.2, volume: 142 },
  esports_2014_summer: { lowest: 18.4, median: 19.2, volume: 38 },
  operation_vanguard: { lowest: 8.2, median: 8.65, volume: 128 },
  chroma: { lowest: 4.3, median: 4.55, volume: 384 },
  chroma_2: { lowest: 3.8, median: 4.05, volume: 412 },
  chroma_3: { lowest: 2.95, median: 3.15, volume: 528 },
  falchion: { lowest: 2.75, median: 2.9, volume: 624 },
  shadow: { lowest: 2.2, median: 2.35, volume: 718 },
  revolver: { lowest: 1.85, median: 1.98, volume: 856 },
  operation_wildfire: { lowest: 4.95, median: 5.2, volume: 296 },
  gamma: { lowest: 2.1, median: 2.25, volume: 642 },
  gamma_2: { lowest: 2.45, median: 2.6, volume: 584 },
  glove: { lowest: 8.95, median: 9.4, volume: 218 },
  spectrum: { lowest: 2.3, median: 2.45, volume: 512 },
  operation_hydra: { lowest: 7.25, median: 7.6, volume: 184 },
  spectrum_2: { lowest: 2.05, median: 2.2, volume: 596 },
  cs20: { lowest: 1.65, median: 1.78, volume: 824 },
  danger_zone: { lowest: 1.2, median: 1.3, volume: 1180 },
  horizon: { lowest: 1.45, median: 1.55, volume: 1042 },
  prisma: { lowest: 1.1, median: 1.18, volume: 1340 },
  prisma_2: { lowest: 1.05, median: 1.12, volume: 1486 },
  shattered_web: { lowest: 1.35, median: 1.45, volume: 1124 },
  operation_riptide: { lowest: 0.95, median: 1.02, volume: 1864 },
  operation_broken_fang: { lowest: 1.78, median: 1.88, volume: 928 },
}
