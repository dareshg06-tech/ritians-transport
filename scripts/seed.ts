// Seed script — populates vehicles, demo users
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 10 sample buses with route numbers covering Chennai
const VEHICLES = [
  { vehicleNumber: "BUS-001", vehicleName: "Bus One",   driverName: "Kumar",   routeNo: "R01" },
  { vehicleNumber: "BUS-002", vehicleName: "Bus Two",   driverName: "Ravi",    routeNo: "R12" },
  { vehicleNumber: "BUS-003", vehicleName: "Bus Three", driverName: "Suresh",  routeNo: "R24" },
  { vehicleNumber: "BUS-004", vehicleName: "Bus Four",   driverName: "Anand",   routeNo: "R16B" },
  { vehicleNumber: "BUS-005", vehicleName: "Bus Five",  driverName: "Mohan",   routeNo: "R29" },
  { vehicleNumber: "BUS-006", vehicleName: "Bus Six",    driverName: "Vinod",   routeNo: "R05" },
  { vehicleNumber: "BUS-007", vehicleName: "Bus Seven",  driverName: "Deepak",  routeNo: "R08" },
  { vehicleNumber: "BUS-008", vehicleName: "Bus Eight",  driverName: "Prakash",  routeNo: "R03A" },
  { vehicleNumber: "BUS-009", vehicleName: "Bus Nine",   driverName: "Arjun",   routeNo: "R16" },
  { vehicleNumber: "BUS-010", vehicleName: "Bus Ten",    driverName: "Bala",    routeNo: "R27" },
];

// Each bus's main destination coords (lat, lng) for initial seed
const ROUTE_COORDS: Record<string, { lat: number; lng: number }> = {
  R01: { lat: 13.2167, lng: 80.3000 }, // Ennore
  R12: { lat: 13.2767, lng: 80.2500 }, // Minjur
  R24: { lat: 12.9100, lng: 79.3300 }, // Arcot
  R16B: { lat: 12.8900, lng: 80.2270 }, // Sholinganallur
  R29: { lat: 12.9800, lng: 80.2200 }, // Velachery
  R05: { lat: 13.0290, lng: 80.2330 }, // CIT Nagar
  R08: { lat: 12.9160, lng: 80.1440 }, // Kovilambakkam
  R03A: { lat: 13.0773, lng: 80.2133 }, // Collector Nagar
  R16: { lat: 12.9300, lng: 80.2500 }, // Neelangkarai
  R27: { lat: 13.1100, lng: 80.1100 }, // Avadi
};

async function main() {
  console.log("Seeding...");

  // Wipe existing data
  await prisma.stopCrossing.deleteMany();
  await prisma.vehicleLocation.deleteMany();
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

  // Create driver users
  for (const v of VEHICLES) {
    await prisma.user.create({
      data: {
        email: `driver@${v.vehicleNumber.toLowerCase()}.local`,
        name: v.driverName,
        role: "driver",
        password: "123456",
      },
    });
  }

  // Create vehicles with their main destination coords
  for (const v of VEHICLES) {
    const coords = ROUTE_COORDS[v.routeNo];
    await prisma.vehicle.create({
      data: {
        vehicleNumber: v.vehicleNumber,
        vehicleName: v.vehicleName,
        vehicleType: "bus",
        driverName: v.driverName,
        routeNo: v.routeNo,
        status: "offline",
        lastLat: coords.lat,
        lastLng: coords.lng,
        lastSpeed: 0,
        lastHeading: 0,
        lastAccuracy: 0,
        lastAltitude: 0,
        lastSeenAt: new Date(Date.now() - 30 * 60 * 1000), // 30 min ago
      },
    });
  }

  const count = await prisma.vehicle.count();
  console.log(`✓ Seeded ${count} vehicles`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
