import Cow from "./entities/Cow";
import Entity from "./entities/Entity";

const ENTITY_CLASS_RECORD: Record<number, () => (new (...args: any[]) => Entity)> = {
   0: () => Cow
};

export default ENTITY_CLASS_RECORD;