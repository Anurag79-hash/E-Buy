Welcome...
Hey this project created by Anurag
Please don't try to copy.Just learn and Explore Your Knowledge
# E-Buy – HandsFree Store (frontend only)

React + Vite. No backend: cart, wishlist, orders and theme are saved in localStorage.

## Run
    npm install
    npm run dev        # http://localhost:5173  (camera works on localhost / HTTPS)
    npm run build      # production build in /dist

## Hands-free
Two buttons (bottom-left, also in the hero): **Eye mode** and **Finger mode**.
- Eye: aim with head/eyes, **wink ONE eye** to click. "Recenter" resets the pointer.
- Finger: aim with index fingertip, **touch thumb tip to index tip** to click.
- Scroll: hold the pointer on the ▲ / ▼ strips at the right edge (scrolls an open cart/product panel first).

## Faster model loading (optional)
    mkdir -p public/mediapipe public/models
    cp -r node_modules/@mediapipe/tasks-vision/wasm public/mediapipe/
    curl -L -o public/models/face_landmarker.task https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
    curl -L -o public/models/hand_landmarker.task https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task
Then set WASM="/mediapipe/wasm", FACE_MODEL="/models/face_landmarker.task", HAND_MODEL="/models/hand_landmarker.task" in src/HandsFree.jsx.

Coupons: SAVE10 (10% off), FREESHIP.

