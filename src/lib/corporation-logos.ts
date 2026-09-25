import { StaticImageData } from "next/image";

import arcadian from "@/assets/corpos/Communautés_Arcadiennes.png";
import astrodrill from "@/assets/corpos/Astrodrill.png";
import cheungshing from "@/assets/corpos/Cheung_Shing_Mars.png";
import credicor from "@/assets/corpos/credicor.png";
import desertron from "@/assets/corpos/Desertron.png";
import ecoline from "@/assets/corpos/ecoline.png";
import ecotec from "@/assets/corpos/Ecotec.png";
import greenpower from "@/assets/corpos/Green_Power.png";
import guildevoleurs from "@/assets/corpos/Guildes_Voleurs.png";
import guildeouvriere from "@/assets/corpos/Guilde_Ouvriere.png";
import helion from "@/assets/corpos/helion.png";
import interplanetarycinematics from "@/assets/corpos/Cinématiques_Interplanétaires.png";
import inventrix from "@/assets/corpos/inventrix.png";
import kuiper from "@/assets/corpos/Kuiper_Cooperative.png";
import ludophile from "@/assets/corpos/Ludophiles.png";
import miningguild from "@/assets/corpos/miningguild.png";
import nirgal from "@/assets/corpos/Nirgal_Entreprises.png";
import palladin from "@/assets/corpos/Palladin_Shipping.png";
import phobolog from "@/assets/corpos/phobolog.png";
import pointluna from "@/assets/corpos/Point_Luna.png";
import recyclon from "@/assets/corpos/Recyclon.png";
import robinsonindustries from "@/assets/corpos/Robinson_Industries.png";
import sagitta from "@/assets/corpos/Sagitta.png";
import saturnsystems from "@/assets/corpos/saturnsystems.png";
import soleilvert from "@/assets/corpos/Soleil_Vert.png";
import spire from "@/assets/corpos/Spire.png";
import splice from "@/assets/corpos/Splice.png";
import teractor from "@/assets/corpos/teractor.png";
import tharsisrepublic from "@/assets/corpos/République_de_Tharsis.png";
import thorgate from "@/assets/corpos/thorgate.png";
import tycho from "@/assets/corpos/Tycho_Magnetics.png";
import unionpharma from "@/assets/corpos/Union_Pharmaceutique.png";
import unmi from "@/assets/corpos/unmi.png";
import valleytrust from "@/assets/corpos/Valley_Trust.png";
import vitor from "@/assets/corpos/Vitor.png";
import wsm from "@/assets/corpos/World_Series_Mars.png";

// Maps corporation display names to their logo asset. Corporations missing
// from this map render as plain text via <CorpLabel />.
export const CORPORATION_LOGOS: Record<string, StaticImageData> = {
    "Communautés Arcadiennes": arcadian,
    "AstroDrill": astrodrill,
    "Cheung Shing Mars": cheungshing,
    "Credicor": credicor,
    "Desertron": desertron,
    "Ecoline": ecoline,
    "Ecotec": ecotec,
    "Green Power": greenpower,
    "Guilde des Voleurs": guildevoleurs,
    "Guilde Ouvrière": guildeouvriere,
    "Helion": helion,
    "Cinématiques Interplanétaires": interplanetarycinematics,
    "Inventrix": inventrix,
    "Kuiper Cooperative": kuiper,
    "Ludophiles d'Asnières et d'ailleurs": ludophile,
    "Mining Guild": miningguild,
    "Nirgal Enterprise": nirgal,
    "Palladin Shipping": palladin,
    "Phobolog": phobolog,
    "Point Luna": pointluna,
    "Recyclon": recyclon,
    "Robinson Industries": robinsonindustries,
    "Sagitta": sagitta,
    "Saturn Systems": saturnsystems,
    "Spire": spire,
    "Soleil Vert": soleilvert,
    "Splice": splice,
    "Teractor": teractor,
    "République de Tharsis": tharsisrepublic,
    "Thorgate": thorgate,
    "Tycho Magnetics": tycho,
    "Union Pharmaceutique": unionpharma,
    "United Nations Mars Initiative": unmi,
    "Valley Trust": valleytrust,
    "Vitor": vitor,
    "World Series Mars": wsm,
};
