import Component from "./Component";

type CircularHitbox = {
   readonly type: "circular";
   readonly radius: number;
}

type RectangularHitbox = {
   readonly type: "rectangular";
   readonly width: number;
   readonly height: number;
}

type Hitbox = CircularHitbox | RectangularHitbox;

class HitboxComponent extends Component {
   public readonly hitbox: Hitbox;

   constructor(hitbox: Hitbox) {
      super();

      this.hitbox = hitbox;
   }
}

export default HitboxComponent;