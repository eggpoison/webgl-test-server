import { ItemType } from "webgl-test-shared";
// import DroppedItem from "../items/DroppedItem";
// import Component from "./Component";
// import Entity from "../entities/Entity";
import Item from "../items/Item";
import Board from "../Board";

// class ItemCreationComponent extends Component {
//    /** Max units that an item can spawn away from the entity when dead */
//    private readonly itemSpawnRange: number;
   
//    constructor(itemSpawnRange: number) {
//       super();

//       this.itemSpawnRange = itemSpawnRange;
//    }

//    public createItemOnDeath(itemType: ItemType, count: number, onlyCreatedOnPlayerKill: boolean): void {
//       this.entity.createEvent("death", (attackingEntity: Entity | null) => {
//          if (onlyCreatedOnPlayerKill && (attackingEntity === null || (attackingEntity.type !== EntityTypeConst.player && attackingEntity.type !== EntityTypeConst.tribesman))) {
//             return;
//          }
         
//          for (let i = 0; i < count; i++) {
//             const magnitude = Math.random() * this.itemSpawnRange;
//             const direction = 2 * Math.PI * Math.random();

//             const position = this.entity.position.copy();
//             position.x += magnitude * Math.sin(direction);
//             position.y += magnitude * Math.cos(direction);

//             const item = new Item(itemType, 1);
//             new DroppedItem(position, item);
//          }
//       });
//    }
// }

// export default ItemCreationComponent;