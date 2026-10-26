import { StaticImageData } from "next/image";

import animal from "@/assets/tags/Tag_Animal.png";
import building from "@/assets/tags/Tag_Building.png";
import cdf from "@/assets/tags/Tag_CDF.png";
import city from "@/assets/tags/Tag_City.png";
import clone from "@/assets/tags/Tag_Clone.png";
import colonie from "@/assets/tags/Tag_Colonie.png";
import crime from "@/assets/tags/Tag_Crime.png";
import earth from "@/assets/tags/Tag_Earth.png";
import event from "@/assets/tags/Tag_Event.png";
import flotteur from "@/assets/tags/Tag_Flotteur.png";
import galaxy from "@/assets/tags/Tag_Galaxy.png";
import iss from "@/assets/tags/Tag_ISS.png";
import jovian from "@/assets/tags/Tag_Jovian.png";
import ludophiles from "@/assets/tags/Tag_Ludophiles.png";
import mars from "@/assets/tags/Tag_Mars.png";
import mercury from "@/assets/tags/Tag_Mercury.png";
import microbe from "@/assets/tags/Tag_Microbe.png";
import moon from "@/assets/tags/Tag_Moon.png";
import multitag from "@/assets/tags/Tag_Multitag.png";
import plant from "@/assets/tags/Tag_Plant.png";
import power from "@/assets/tags/Tag_Power.png";
import radiations from "@/assets/tags/Tag_Radiations.png";
import science from "@/assets/tags/Tag_Science.png";
import space from "@/assets/tags/Tag_Space.png";
import upgrade from "@/assets/tags/Tag_Upgrade.png";
import venus from "@/assets/tags/Tag_Venus.png";
import wild from "@/assets/tags/Tag_Wild.png";

// Terraforming Mars card-tag icons, reused as pick-a-logo options for Finale
// teams (there's no team-logo upload — organizers pick one of these instead).
// Keys are what gets persisted as Team.tag.
export const TEAM_TAGS: Record<string, StaticImageData> = {
    "Animal": animal,
    "Building": building,
    "CDF": cdf,
    "City": city,
    "Clone": clone,
    "Colonie": colonie,
    "Crime": crime,
    "Earth": earth,
    "Event": event,
    "Flotteur": flotteur,
    "Galaxy": galaxy,
    "ISS": iss,
    "Jovian": jovian,
    "Ludophiles": ludophiles,
    "Mars": mars,
    "Mercury": mercury,
    "Microbe": microbe,
    "Moon": moon,
    "Multitag": multitag,
    "Plant": plant,
    "Power": power,
    "Radiations": radiations,
    "Science": science,
    "Space": space,
    "Upgrade": upgrade,
    "Venus": venus,
    "Wild": wild,
};

export const TEAM_TAG_NAMES = Object.keys(TEAM_TAGS);
