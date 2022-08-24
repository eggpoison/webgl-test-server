import { EntityType } from "webgl-test-shared";
import Cow from "./entities/Cow";
import Entity from "./entities/Entity";
import Player from "./entities/Player";

const ENTITY_CLASS_RECORD: Record<EntityType, () => (new (...args: any[]) => Entity)> = {
   cow: () => Cow,
   player: () => Player
};

export default ENTITY_CLASS_RECORD;