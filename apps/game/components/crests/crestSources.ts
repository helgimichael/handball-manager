// HM-PLAYTEST-01 5.3: where each playable club's official crest was found
// (researched 2026-11-02), and its reuse status. DATA ONLY -- nothing here is
// downloaded or rendered. Per ./clubCrests.ts, a crest is registered only
// once the club/rights holder has given permission or the file carries a
// licence allowing redistribution in a game. None of the sources below
// does: club sites state no licence, and the Wikipedia files are non-free
// (fair use on en.wikipedia only). The one Commons file (IFK Skövde,
// PD-textlogo) is the multi-sport IFK Skövde mark, not verified as the
// handball club's own crest. Use this list to request permission.
export type CrestSourceStatus = "CLUB_SITE_NO_LICENCE" | "WIKIPEDIA_NON_FREE" | "COMMONS_PD_UNVERIFIED" | "NOT_FOUND";

export const CREST_SOURCES: Readonly<Record<string, { url: string | null; page: string | null; status: CrestSourceStatus }>> = {
  se_club_alingsas_hk: { url: "https://upload.wikimedia.org/wikipedia/en/a/af/Alingsas_HK_logo.svg", page: "https://en.wikipedia.org/wiki/File:Alingsas_HK_logo.svg", status: "WIKIPEDIA_NON_FREE" },
  se_club_amo_hk: { url: "https://d1da7yrcucvk6m.cloudfront.net/sites/621/template_assets/logo.png", page: "https://amohandboll.com/", status: "CLUB_SITE_NO_LICENCE" },
  se_club_hammarby_if_hf: { url: "https://www.svenskalag.se/img/clubmarks/5926.png", page: "https://www.hammarbyhandboll.se/", status: "CLUB_SITE_NO_LICENCE" },
  se_club_hf_karlskrona: { url: "https://hfk.se/wp-content/uploads/2026/08/SVG-HFK-Retro-Logotyp-Badge-RGB-Original.svg", page: "https://hfk.se/", status: "CLUB_SITE_NO_LICENCE" },
  se_club_hk_malmo: { url: "https://hkmalmo.se/wp-content/uploads/2026/05/HK-Malmo-Logo.png", page: "https://www.hkmalmo.se/", status: "CLUB_SITE_NO_LICENCE" },
  se_club_if_hallby_hk: { url: "https://cdn.sportadmin.se/2641/3c26224a490017eeddb6ebff5dca7b90e7bb09eacb92206f93fa419992077f23_L.webp", page: "https://www.hallbyhandboll.se/", status: "CLUB_SITE_NO_LICENCE" },
  se_club_ifk_kristianstad: { url: "https://upload.wikimedia.org/wikipedia/en/5/5d/IFK_Kristianstad_logo.svg", page: "https://en.wikipedia.org/wiki/File:IFK_Kristianstad_logo.svg", status: "WIKIPEDIA_NON_FREE" },
  se_club_ifk_skovde_hk: { url: "https://upload.wikimedia.org/wikipedia/commons/a/ae/IFK_Skovde_logo.svg", page: "https://commons.wikimedia.org/wiki/File:IFK_Skovde_logo.svg", status: "COMMONS_PD_UNVERIFIED" },
  se_club_ik_savehof: { url: "https://savehof.se/wp-content/uploads/2026/06/logotyp.png", page: "https://www.savehof.se/", status: "CLUB_SITE_NO_LICENCE" },
  se_club_lugi_hf: { url: "https://www.lugihandboll.se/wp-content/uploads/2025/09/lugi-1.svg", page: "https://www.lugihandboll.se/", status: "CLUB_SITE_NO_LICENCE" },
  se_club_ov_helsingborg: { url: "https://myclub-site.s3.amazonaws.com/uploads/images/000/090/221/ov_logo_RGB.jpg", page: "https://ovhelsingborg.myclub.se/menu/pages/24295/", status: "CLUB_SITE_NO_LICENCE" },
  se_club_skanela_if: { url: "https://cdn.sportadmin.se/1905/b5256761a01a7d50c381e217fe5ece221b31a2ad8092d8ef0aeaba52b5b9b0a7_L.webp", page: "https://www.skanela.se/", status: "CLUB_SITE_NO_LICENCE" },
  se_club_ystads_if_hf: { url: null, page: null, status: "NOT_FOUND" },
  se_club_onnereds_hk: { url: "https://cdn.sportadmin.se/3055/cc7331facda891d52f0cfde0cbbb47e2e3c8810c9ef9ae8344da067e24ca7d97_L.png", page: "https://www.onneredshk.se/", status: "CLUB_SITE_NO_LICENCE" },
  "swe2-aranas": { url: "https://cdn.sportadmin.se/1576/e2e1acd20c371d89e096218153c14205a6c0f2f266d7c9c2581d08dad604e3d5_L.png", page: "https://www.hkaranas.se/", status: "CLUB_SITE_NO_LICENCE" },
  "swe2-drott": { url: "https://www.svenskalag.se/img/clubmarks/5713.png", page: "https://www.hkdrott.se/", status: "CLUB_SITE_NO_LICENCE" },
  "swe2-guif": { url: "https://upload.wikimedia.org/wikipedia/en/2/28/Eskilstuna_Guif_logo.svg", page: "https://en.wikipedia.org/wiki/File:Eskilstuna_Guif_logo.svg", status: "WIKIPEDIA_NON_FREE" },
  "swe2-h43lund": { url: "https://d202bb1f52.clvaw-cdnwnd.com/a367e8a4d86e74f3fa8a7b21610f33ae/200000041-cc661cc663/_genLogga.png", page: "https://www.h43lund.se/", status: "CLUB_SITE_NO_LICENCE" },
  "swe2-huddinge": { url: "https://cdn06.svenskalag.se/img/clubmarks/5950_w.png", page: "https://www.svenskalag.se/huddingehk", status: "CLUB_SITE_NO_LICENCE" },
  "swe2-kroppskultur": { url: "https://cdn.sportadmin.se/2587/45d4113a0d2024f6395d4b3c834e5b3e99e78576d7210b9ce9e23506e2c64c85_L.webp", page: "https://www.kroppskultur.com", status: "CLUB_SITE_NO_LICENCE" },
  "swe2-kungalv": { url: "https://cdn.sportadmin.se/2908/34872e6527adaf4a532dae0bc354e2cd829285d11e24d487add86c5eb78dbabc_L.png", page: "https://kungalvhk.web.sportadmin.se/start/", status: "CLUB_SITE_NO_LICENCE" },
  "swe2-redbergslid": { url: "https://www.redbergslid.se/wp-content/uploads/2019/09/cropped-RIK_logo-1-2-229x300.png", page: "https://www.redbergslid.se/", status: "CLUB_SITE_NO_LICENCE" },
  "swe2-torslanda": { url: null, page: null, status: "NOT_FOUND" },
  "swe2-tumba": { url: "https://www.svenskalag.se/img/clubmarks/5953.png", page: "https://www.svenskalag.se/tumbahandboll", status: "CLUB_SITE_NO_LICENCE" },
  "swe2-tyreso": { url: "https://cdn.sportadmin.se/1707/68b8522f055f5e91bfc420343b7530b5976a54dfa6b7f18991b82a15ac202768_L.webp", page: "https://www.tyresohandboll.se/", status: "CLUB_SITE_NO_LICENCE" },
  "swe2-varberg": { url: "https://myclub-site.s3.amazonaws.com/uploads/images/000/128/443/sm_square_HKV_logo_-_gr_n.png", page: "http://hkvarberg.myclub.se/", status: "CLUB_SITE_NO_LICENCE" },
  "swe2-vasterasirsta": { url: "https://cdn.sportadmin.se/1704/fa89adff1f218a975e3db4162533c1474a75f2109ac724b02721685b9cc67a39_L.png", page: "https://www.vasterasirsta.se/", status: "CLUB_SITE_NO_LICENCE" },
  "swe2-ystad2": { url: "https://cdn.sportadmin.se/1580/557d4380e1478b948cb880be07dfe48ca9a7695f4b2802e3f984050604237324_L.webp", page: "https://www.ifkystad.se/", status: "CLUB_SITE_NO_LICENCE" },
};
