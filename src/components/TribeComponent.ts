import { TribeType } from "webgl-test-shared";
import Tribe from "../Tribe";

export interface TribeComponent {
   readonly tribeType: TribeType;
   tribe: Tribe | null;
}