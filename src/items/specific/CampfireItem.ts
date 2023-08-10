import { Point } from "webgl-test-shared";
import Entity from "../../entities/Entity";
import TribeMember from "../../entities/tribes/TribeMember";
import PlaceableItem from "../generic/PlaceableItem";
import Campfire from "../../entities/Campfire";

class CampfireItem extends PlaceableItem {
   protected spawnEntity(_tribeMember: TribeMember, position: Point): Entity {
      return new Campfire(position, false);
   }
}

export default CampfireItem;