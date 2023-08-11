import { Point } from "webgl-test-shared";
import Entity from "../../entities/Entity";
import PlaceableItem from "../generic/PlaceableItem";
import TribeHut from "../../entities/tribes/TribeHut";
import TribeMember from "../../entities/tribes/TribeMember";

class TribeHutItem extends PlaceableItem {
   protected spawnEntity(tribeMember: TribeMember, position: Point): Entity {
      if (tribeMember.tribe === null) {
         throw new Error("Tribe was null when placing a tribe hut.");
      }
      
      return new TribeHut(position, false, tribeMember.tribe);
   }

}

export default TribeHutItem;