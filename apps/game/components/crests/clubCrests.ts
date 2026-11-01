// HM-ALPHA3-M01: authentic club crests, mapped to stable club ids.
//
// An entry may only be added when the crest may actually be reused in the
// game: the club (or the rights holder) has given permission, or the image
// is under a licence that allows redistribution in a game. A logo being
// publicly visible -- on a club site, Wikipedia or social media -- is NOT
// permission. Until an entry exists, <ClubCrest> draws the club-coloured
// fallback shield, which is always correct to show.
//
// To add a crest: put an optimised file in ./assets/ (SVG sanitised of
// scripts/external references, or a square transparent WebP/PNG at
// 256 px, ideally < 15 KB), import it here, and record where it came from
// and on what terms. See ./assets/README.md.
//
// Scope: Handbollsligan and Herrallsvenskan clubs first.
import type { StaticImageData } from "next/image";

export interface ClubCrestAsset {
  src: StaticImageData | string;
  /** Who supplied it, e.g. "Klubbens presskit (mejl 2026-11-04)". */
  source: string;
  /** The terms it is used under, e.g. "Skriftligt tillstånd för spelet". */
  usage: string;
}

export const CLUB_CREST_ASSETS: Readonly<Partial<Record<string, ClubCrestAsset>>> = {};

export function getClubCrestAsset(clubId: string | undefined): ClubCrestAsset | undefined {
  return clubId ? CLUB_CREST_ASSETS[clubId] : undefined;
}

/** Resolves an imported asset to a URL, whether Next gave us a StaticImageData object or a string. */
export function crestAssetUrl(asset: ClubCrestAsset): string {
  return typeof asset.src === "string" ? asset.src : asset.src.src;
}
