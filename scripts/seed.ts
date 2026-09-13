// Seed script — populates vehicles for ALL 54 routes
import { PrismaClient } from "@prisma/client";
import { routes as ALL_ROUTES } from "../src/lib/ritians/data";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding all 54 routes...");

  // Wipe existing data
  await prisma.stopCrossing.deleteMany();
  await prisma.vehicleLocation.deleteMany();
  await prisma.busLocationAnomaly.deleteMany();
  await prisma.trackingSession.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.user.deleteMany();

  // Create admin user
  await prisma.user.create({
    data: {
      email: "admin@ritians.edu",
      name: "Admin",
      role: "admin",
      password: "123456",
    },
  });

  // Create a vehicle for EVERY route in data.ts (54 routes)
  for (let i = 0; i < ALL_ROUTES.length; i++) {
    const r = ALL_ROUTES[i];
    const vehicleNumber = `BUS-${String(i + 1).padStart(3, "0")}`;
    const driverName = `Driver ${i + 1}`;

    // Create driver user
    await prisma.user.create({
      data: {
        email: `driver@bus${String(i + 1).padStart(3, "0")}.local`,
        name: driverName,
        role: "driver",
        password: "123456",
      },
    });

    // Create vehicle with the route's main destination coords
    await prisma.vehicle.create({
      data: {
        vehicleNumber,
        vehicleName: r.routeName,
        vehicleType: "bus",
        driverName,
        routeNo: r.routeNo,
        status: "offline",
        lastLat: r.coords.lat,
        lastLng: r.coords.lng,
        lastSpeed: 0,
        lastHeading: 0,
        lastAccuracy: 0,
        lastAltitude: 0,
        lastSeenAt: new Date(Date.now() - 30 * 60 * 1000), // 30 min ago
      },
    });
  }

  const count = await prisma.vehicle.count();
  console.log(`✓ Seeded ${count} vehicles for all routes`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
