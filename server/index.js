import { createJargServer } from "./app.js";

const port = Number(process.env.PORT || 3100);
const server = createJargServer();
server.listen(port, () => console.log(`JARG Advanced: http://localhost:${port}`));
