import { TribeType } from "webgl-test-shared";
import Tribe from "./Tribe";
import TRIBE_INFO_RECORD from "webgl-test-shared/lib/tribes";

export function generateAITribe(type: TribeType): Tribe {
   const tribeInfo = TRIBE_INFO_RECORD[type];
   
   const tribe = new Tribe(type);

   return tribe;
}