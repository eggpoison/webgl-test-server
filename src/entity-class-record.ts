import { EntityType } from "webgl-test-shared";
import Cow from "./entities/Cow";
import Entity from "./entities/Entity";
import Player from "./entities/Player";
import Zombie from "./entities/Zombie";

const ENTITY_CLASS_RECORD: Record<EntityType, () => (new (...args: any[]) => Entity)> = {
   cow: () => Cow,
   zombie: () => Zombie,
   player: () => Player
};

export default ENTITY_CLASS_RECORD;