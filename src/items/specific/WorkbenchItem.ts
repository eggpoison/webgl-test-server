import { Point } from "webgl-test-shared";
import Entity from "../../entities/Entity";
import PlaceableItem from "../generic/PlaceableItem";
import Workbench from "../../entities/Workbench";
import TribeMember from "../../entities/tribes/TribeMember";

class WorkbenchItem extends PlaceableItem {
   protected spawnEntity(_tribeMember: TribeMember, position: Point): Entity {
      return new Workbench(position);
   }
}

export default WorkbenchItem;