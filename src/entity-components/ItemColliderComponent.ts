// import ItemEntity from "../items/ItemEntity";
// import Component from "./Component";

// class ItemColliderComponent extends Component {
//    public tick(): void {
//       const nearbyItemEntities = this.getNearbyItemEntities();
//       const collidingItemEntities = this.getCollidingItemEntities(nearbyItemEntities);

//       for (const itemEntity of collidingItemEntities) {
//          this.entity.callEvents("enter_collision", itemEntity);
//       }
//    }

//    private getNearbyItemEntities(): Set<ItemEntity> {
//       const nearbyItemEntities = new Set<ItemEntity>();
//       for (const chunk of this.entity.chunks) {
//          for (const itemEntity of chunk.getItemEntities()) {
//             if (!nearbyItemEntities.has(itemEntity)) {
//                nearbyItemEntities.add(itemEntity);
//             }
//          }
//       }
//       return nearbyItemEntities;

//    }

//    private getCollidingItemEntities(nearbyItemEntities: Set<ItemEntity>): Set<ItemEntity> {
//       const collidingItemEntities = new Set<ItemEntity>();

//       itemLoop: for (const itemEntity of nearbyItemEntities) {
//          for (const hitbox of this.entity.hitboxes) {
//             if (hitbox.isColliding(itemEntity.hitbox)) {
//                collidingItemEntities.add(itemEntity);
//                continue itemLoop;
//             }
//          }
//       }

//       return collidingItemEntities;
//    }
// }

// export default ItemColliderComponent;