import "dotenv/config";
import app from "./app";

const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || "0.0.0.0";

app.listen(Number(PORT), HOST, () => {
  console.log(`Khan Sofa API listening on http://${HOST}:${PORT}`);
});
