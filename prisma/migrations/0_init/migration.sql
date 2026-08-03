-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('SEND_EMAIL', 'SEND_SMS', 'ADD_TAG', 'CREATE_TASK', 'CREATE_NOTE', 'WAIT');

-- CreateEnum
CREATE TYPE "AgencyStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('SMS', 'EMAIL', 'WHATSAPP', 'WEBCHAT', 'NOTE', 'FACEBOOK', 'INSTAGRAM', 'PHONE');

-- CreateEnum
CREATE TYPE "ConnectListingStatus" AS ENUM ('ACTIVE', 'SOLD');

-- CreateEnum
CREATE TYPE "ConnectionProvider" AS ENUM ('GMAIL', 'OUTLOOK', 'SMTP', 'FACEBOOK', 'INSTAGRAM', 'GOOGLE_BUSINESS', 'WHATSAPP', 'TWILIO', 'STRIPE', 'GOOGLE_CALENDAR', 'SQUARE', 'SHOPIFY', 'EBAY', 'TIKTOK', 'FACEBOOK_SHOP', 'INSTAGRAM_SHOP', 'WHATNOT', 'YOUTUBE', 'SNAPCHAT', 'GOOGLE');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'ERROR', 'PENDING');

-- CreateEnum
CREATE TYPE "CustomFieldType" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT');

-- CreateEnum
CREATE TYPE "DeliveryScope" AS ENUM ('OWN', 'SHARED');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('POSTED', 'ACCEPTED', 'PICKED_UP', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DriverStatus" AS ENUM ('PENDING', 'APPROVED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "FormType" AS ENUM ('FORM', 'SURVEY');

-- CreateEnum
CREATE TYPE "GlobalRole" AS ENUM ('SUPER_ADMIN', 'AGENCY_USER');

-- CreateEnum
CREATE TYPE "HomesteadBookingStatus" AS ENUM ('PENDING', 'ACTIVE', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ListingAiStatus" AS ENUM ('UNOPTIMISED', 'OPTIMISING', 'OPTIMISED', 'FAILED');

-- CreateEnum
CREATE TYPE "ListingBatchStatus" AS ENUM ('DRAFT', 'OPTIMISED', 'PUBLISHED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "LocationRole" AS ENUM ('ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "Marketplace" AS ENUM ('PLACID_CONNECT', 'EBAY', 'AMAZON', 'TEMU', 'FACEBOOK', 'GOOGLE', 'TIKTOK');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('OPEN', 'WON', 'LOST', 'ABANDONED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('NEW', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('PRODUCT', 'DELIVERY');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "SocialPostStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "StorageBookingStatus" AS ENUM ('PENDING_PAYMENT', 'ACTIVE', 'SUSPENDED', 'CANCELLED', 'ENDED', 'WAITLISTED');

-- CreateEnum
CREATE TYPE "StorageRequestStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "StorageSpotType" AS ENUM ('CAR', 'CONTAINER');

-- CreateEnum
CREATE TYPE "StorageTerm" AS ENUM ('WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "TriggerType" AS ENUM ('CONTACT_CREATED', 'TAG_ADDED', 'OPPORTUNITY_CREATED', 'FORM_SUBMITTED', 'MANUAL');

-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED');

-- CreateTable
CREATE TABLE "Agency" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "status" "AgencyStatus" NOT NULL DEFAULT 'ACTIVE',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,

    CONSTRAINT "Agency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "contactId" TEXT,
    "title" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'CONFIRMED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "externalEventId" TEXT,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Calendar" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "availability" JSONB NOT NULL DEFAULT '{}',
    "bookingWindowDays" INTEGER NOT NULL DEFAULT 14,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "price" INTEGER,
    "intakeFields" JSONB NOT NULL DEFAULT '[]',
    "calloutFeeCents" INTEGER,
    "travelFeeCents" INTEGER,
    "travelFreeKm" INTEGER,
    "travelPerKmCents" INTEGER,

    CONSTRAINT "Calendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallLog" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "callSid" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'inbound',
    "fromNumber" TEXT NOT NULL,
    "toNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in-progress',
    "transcript" JSONB NOT NULL DEFAULT '[]',
    "summary" TEXT,
    "contactId" TEXT,
    "durationSec" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rule" JSONB NOT NULL DEFAULT '{}',
    "productIds" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConnectComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectFriend" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConnectFriend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "coverColor" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConnectGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectGroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConnectGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectLike" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConnectLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectListing" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" INTEGER NOT NULL DEFAULT 0,
    "category" TEXT NOT NULL,
    "condition" TEXT,
    "location" TEXT,
    "imageUrl" TEXT,
    "status" "ConnectListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConnectListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectMember" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConnectMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectPost" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "bg" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "groupId" TEXT,

    CONSTRAINT "ConnectPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Connection" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "provider" "ConnectionProvider" NOT NULL,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'CONNECTED',
    "accountLabel" TEXT,
    "secretCipher" TEXT,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Connection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "companyName" TEXT,
    "source" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "externalId" TEXT,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactTag" (
    "contactId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "ContactTag_pkey" PRIMARY KEY ("contactId","tagId")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "contactId" TEXT,
    "channel" "Channel" NOT NULL DEFAULT 'SMS',
    "subject" TEXT,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unread" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "starred" BOOLEAN NOT NULL DEFAULT false,
    "sourceLabel" TEXT,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomField" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "type" "CustomFieldType" NOT NULL DEFAULT 'TEXT',
    "options" TEXT,

    CONSTRAINT "CustomField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomFieldValue" (
    "id" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "value" TEXT,

    CONSTRAINT "CustomFieldValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryJob" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "orderId" TEXT,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'POSTED',
    "scope" "DeliveryScope" NOT NULL DEFAULT 'SHARED',
    "driverId" TEXT,
    "pickupAddress" TEXT NOT NULL,
    "dropoffAddress" TEXT NOT NULL,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "fee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "DeliveryJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "vehicle" TEXT,
    "status" "DriverStatus" NOT NULL DEFAULT 'APPROVED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalBusy" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "provider" "ConnectionProvider" NOT NULL DEFAULT 'GOOGLE_CALENDAR',
    "externalId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "summary" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalBusy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Form" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FormType" NOT NULL DEFAULT 'FORM',
    "description" TEXT,
    "fields" JSONB NOT NULL DEFAULT '[]',
    "submitLabel" TEXT NOT NULL DEFAULT 'Submit',
    "thankYou" TEXT NOT NULL DEFAULT 'Thanks — we''ll be in touch shortly.',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Form_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormSubmission" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "contactId" TEXT,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomesteadBooking" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "roomId" TEXT,
    "guestName" TEXT NOT NULL,
    "guestEmail" TEXT NOT NULL,
    "guestPhone" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "weeklyPrice" INTEGER NOT NULL DEFAULT 0,
    "status" "HomesteadBookingStatus" NOT NULL DEFAULT 'PENDING',
    "contractAccepted" BOOLEAN NOT NULL DEFAULT false,
    "signature" TEXT,
    "stripeSubId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomesteadBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomesteadRoom" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "weeklyPrice" INTEGER NOT NULL DEFAULT 0,
    "imageUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomesteadRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomesteadSettings" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "houseRules" TEXT,
    "welcomeInfo" TEXT,
    "contractText" TEXT,
    "bookingWindowDays" INTEGER NOT NULL DEFAULT 21,
    "depositWeeks" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "HomesteadSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxFolder" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#8e2de2',
    "matchField" TEXT NOT NULL DEFAULT 'SENDER',
    "matchValue" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboxFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingBatch" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "marketplace" "Marketplace" NOT NULL,
    "status" "ListingBatchStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingItem" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "fields" JSONB NOT NULL DEFAULT '{}',
    "aiStatus" "ListingAiStatus" NOT NULL DEFAULT 'UNOPTIMISED',
    "validation" JSONB NOT NULL DEFAULT '[]',
    "publishStatus" TEXT,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "industry" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Australia/Brisbane',
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "addressLine" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "country" TEXT DEFAULT 'Australia',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyNumber" TEXT,
    "taxId" TEXT,
    "wantedIntegrations" JSONB NOT NULL DEFAULT '[]',
    "stripeAccountId" TEXT,
    "stripeChargesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "stripeDetailsSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "stripePayoutsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "ordersPipelineId" TEXT,
    "ordersStageId" TEXT,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "role" "LocationRole" NOT NULL DEFAULT 'ADMIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "direction" "MessageDirection" NOT NULL DEFAULT 'OUTBOUND',
    "channel" "Channel" NOT NULL DEFAULT 'SMS',
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "messageId" TEXT,
    "receivedAt" TIMESTAMP(3),

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "contactId" TEXT,
    "title" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "OpportunityStatus" NOT NULL DEFAULT 'OPEN',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "contactId" TEXT,
    "number" INTEGER NOT NULL DEFAULT 0,
    "type" "OrderType" NOT NULL DEFAULT 'PRODUCT',
    "status" "OrderStatus" NOT NULL DEFAULT 'NEW',
    "items" JSONB NOT NULL DEFAULT '[]',
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "customerEmail" TEXT,
    "deliveryAddress" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "externalId" TEXT,
    "source" TEXT,
    "placedAt" TIMESTAMP(3),

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pipeline" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pipeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipelineStage" (
    "id" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PipelineStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER,
    "description" TEXT,
    "imageUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "category" TEXT,
    "channels" JSONB NOT NULL DEFAULT '[]',
    "externalId" TEXT,
    "inventory" INTEGER,
    "priceCents" INTEGER,
    "sku" TEXT,
    "source" TEXT,
    "vendor" TEXT,
    "shipCountries" JSONB NOT NULL DEFAULT '[]',
    "supplier" TEXT,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "warehouse" TEXT,
    "costCents" INTEGER,
    "freightCents" INTEGER,
    "colour" TEXT,
    "images" JSONB NOT NULL DEFAULT '[]',
    "categoryId" TEXT,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCategory" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RenderJob" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "presenter" TEXT NOT NULL DEFAULT 'dave',
    "script" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "note" TEXT,
    "mediaAssetId" TEXT,
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RenderJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "valueCipher" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "primaryColor" TEXT NOT NULL DEFAULT '#1d5df5',
    "logoText" TEXT,
    "tagline" TEXT,
    "customDomain" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'light',

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SitePage" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "blocks" JSONB NOT NULL DEFAULT '[]',
    "isHome" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "seoDescription" TEXT,
    "seoTitle" TEXT,

    CONSTRAINT "SitePage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialPost" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "mediaUrls" JSONB NOT NULL DEFAULT '[]',
    "mediaKind" TEXT,
    "networks" JSONB NOT NULL DEFAULT '[]',
    "results" JSONB NOT NULL DEFAULT '{}',
    "scheduledAt" TIMESTAMP(3),
    "status" "SocialPostStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "options" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "SocialPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StageAction" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StageAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorageBooking" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "contactId" TEXT,
    "productId" TEXT,
    "spotType" "StorageSpotType" NOT NULL,
    "term" "StorageTerm" NOT NULL DEFAULT 'MONTHLY',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "openEnded" BOOLEAN NOT NULL DEFAULT true,
    "amountCents" INTEGER NOT NULL DEFAULT 0,
    "status" "StorageBookingStatus" NOT NULL DEFAULT 'ACTIVE',
    "pin" TEXT,
    "spotLabel" TEXT,
    "storedDescription" TEXT,
    "vehicleMake" TEXT,
    "vehicleModel" TEXT,
    "vehicleRego" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorageBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorageProduct" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "spotType" "StorageSpotType" NOT NULL,
    "sizeLabel" TEXT,
    "priceMonthlyCents" INTEGER NOT NULL DEFAULT 0,
    "priceWeeklyCents" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "StorageProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorageServiceRequest" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "bookingRef" TEXT,
    "contactId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "StorageRequestStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StorageServiceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorageSettings" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "siteAddress" TEXT,
    "carCapacity" INTEGER NOT NULL DEFAULT 0,
    "containerCapacity" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorageSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorageWaitlist" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "spotType" "StorageSpotType" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "contactId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "productName" TEXT,
    "requestedStart" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StorageWaitlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#337dff',

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "contactId" TEXT,
    "assigneeId" TEXT,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "dueAt" TIMESTAMP(3),
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageEvent" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "unitCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "ref" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "globalRole" "GlobalRole" NOT NULL DEFAULT 'AGENCY_USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceAgent" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "greeting" TEXT,
    "hours" TEXT,
    "knowledge" TEXT,
    "transferTo" TEXT,
    "voice" TEXT NOT NULL DEFAULT 'Polly.Olivia-Neural',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workflow" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'DRAFT',
    "triggerType" "TriggerType" NOT NULL DEFAULT 'MANUAL',
    "triggerConfig" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowRun" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "contactId" TEXT,
    "status" "RunStatus" NOT NULL DEFAULT 'RUNNING',
    "trigger" TEXT,
    "context" JSONB NOT NULL DEFAULT '{}',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "WorkflowRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowRunStep" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "actionType" "ActionType" NOT NULL,
    "status" TEXT NOT NULL,
    "detail" TEXT,
    "ranAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowRunStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowStep" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "actionType" "ActionType" NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "WorkflowStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Appointment_locationId_idx" ON "Appointment"("locationId" ASC);

-- CreateIndex
CREATE INDEX "Appointment_locationId_startAt_idx" ON "Appointment"("locationId" ASC, "startAt" ASC);

-- CreateIndex
CREATE INDEX "Calendar_locationId_idx" ON "Calendar"("locationId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Calendar_locationId_slug_key" ON "Calendar"("locationId" ASC, "slug" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "CallLog_callSid_key" ON "CallLog"("callSid" ASC);

-- CreateIndex
CREATE INDEX "CallLog_locationId_createdAt_idx" ON "CallLog"("locationId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "CallLog_locationId_idx" ON "CallLog"("locationId" ASC);

-- CreateIndex
CREATE INDEX "Collection_locationId_idx" ON "Collection"("locationId" ASC);

-- CreateIndex
CREATE INDEX "ConnectComment_postId_idx" ON "ConnectComment"("postId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ConnectFriend_followerId_followingId_key" ON "ConnectFriend"("followerId" ASC, "followingId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ConnectGroup_slug_key" ON "ConnectGroup"("slug" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ConnectGroupMember_groupId_memberId_key" ON "ConnectGroupMember"("groupId" ASC, "memberId" ASC);

-- CreateIndex
CREATE INDEX "ConnectGroupMember_memberId_idx" ON "ConnectGroupMember"("memberId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ConnectLike_postId_memberId_key" ON "ConnectLike"("postId" ASC, "memberId" ASC);

-- CreateIndex
CREATE INDEX "ConnectListing_category_idx" ON "ConnectListing"("category" ASC);

-- CreateIndex
CREATE INDEX "ConnectListing_status_createdAt_idx" ON "ConnectListing"("status" ASC, "createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ConnectMember_email_key" ON "ConnectMember"("email" ASC);

-- CreateIndex
CREATE INDEX "ConnectMember_handle_idx" ON "ConnectMember"("handle" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ConnectMember_handle_key" ON "ConnectMember"("handle" ASC);

-- CreateIndex
CREATE INDEX "ConnectPost_authorId_idx" ON "ConnectPost"("authorId" ASC);

-- CreateIndex
CREATE INDEX "ConnectPost_createdAt_idx" ON "ConnectPost"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "ConnectPost_groupId_idx" ON "ConnectPost"("groupId" ASC);

-- CreateIndex
CREATE INDEX "Connection_locationId_idx" ON "Connection"("locationId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Connection_locationId_provider_key" ON "Connection"("locationId" ASC, "provider" ASC);

-- CreateIndex
CREATE INDEX "Contact_locationId_email_idx" ON "Contact"("locationId" ASC, "email" ASC);

-- CreateIndex
CREATE INDEX "Contact_locationId_externalId_idx" ON "Contact"("locationId" ASC, "externalId" ASC);

-- CreateIndex
CREATE INDEX "Contact_locationId_idx" ON "Contact"("locationId" ASC);

-- CreateIndex
CREATE INDEX "ContactTag_tagId_idx" ON "ContactTag"("tagId" ASC);

-- CreateIndex
CREATE INDEX "Conversation_locationId_idx" ON "Conversation"("locationId" ASC);

-- CreateIndex
CREATE INDEX "Conversation_locationId_lastMessageAt_idx" ON "Conversation"("locationId" ASC, "lastMessageAt" ASC);

-- CreateIndex
CREATE INDEX "Conversation_locationId_sourceLabel_idx" ON "Conversation"("locationId" ASC, "sourceLabel" ASC);

-- CreateIndex
CREATE INDEX "CustomField_locationId_idx" ON "CustomField"("locationId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "CustomField_locationId_key_key" ON "CustomField"("locationId" ASC, "key" ASC);

-- CreateIndex
CREATE INDEX "CustomFieldValue_contactId_idx" ON "CustomFieldValue"("contactId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "CustomFieldValue_fieldId_contactId_key" ON "CustomFieldValue"("fieldId" ASC, "contactId" ASC);

-- CreateIndex
CREATE INDEX "DeliveryJob_driverId_idx" ON "DeliveryJob"("driverId" ASC);

-- CreateIndex
CREATE INDEX "DeliveryJob_locationId_idx" ON "DeliveryJob"("locationId" ASC);

-- CreateIndex
CREATE INDEX "DeliveryJob_status_idx" ON "DeliveryJob"("status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Driver_email_key" ON "Driver"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ExternalBusy_locationId_provider_externalId_key" ON "ExternalBusy"("locationId" ASC, "provider" ASC, "externalId" ASC);

-- CreateIndex
CREATE INDEX "ExternalBusy_locationId_startAt_idx" ON "ExternalBusy"("locationId" ASC, "startAt" ASC);

-- CreateIndex
CREATE INDEX "Form_locationId_idx" ON "Form"("locationId" ASC);

-- CreateIndex
CREATE INDEX "FormSubmission_formId_idx" ON "FormSubmission"("formId" ASC);

-- CreateIndex
CREATE INDEX "FormSubmission_locationId_idx" ON "FormSubmission"("locationId" ASC);

-- CreateIndex
CREATE INDEX "HomesteadBooking_locationId_idx" ON "HomesteadBooking"("locationId" ASC);

-- CreateIndex
CREATE INDEX "HomesteadBooking_locationId_status_idx" ON "HomesteadBooking"("locationId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "HomesteadRoom_locationId_idx" ON "HomesteadRoom"("locationId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "HomesteadSettings_locationId_key" ON "HomesteadSettings"("locationId" ASC);

-- CreateIndex
CREATE INDEX "InboxFolder_locationId_idx" ON "InboxFolder"("locationId" ASC);

-- CreateIndex
CREATE INDEX "ListingBatch_locationId_idx" ON "ListingBatch"("locationId" ASC);

-- CreateIndex
CREATE INDEX "ListingBatch_locationId_marketplace_idx" ON "ListingBatch"("locationId" ASC, "marketplace" ASC);

-- CreateIndex
CREATE INDEX "ListingItem_batchId_idx" ON "ListingItem"("batchId" ASC);

-- CreateIndex
CREATE INDEX "Location_agencyId_idx" ON "Location"("agencyId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Location_slug_key" ON "Location"("slug" ASC);

-- CreateIndex
CREATE INDEX "MediaAsset_locationId_idx" ON "MediaAsset"("locationId" ASC);

-- CreateIndex
CREATE INDEX "Membership_locationId_idx" ON "Membership"("locationId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_locationId_key" ON "Membership"("userId" ASC, "locationId" ASC);

-- CreateIndex
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId" ASC);

-- CreateIndex
CREATE INDEX "Message_messageId_idx" ON "Message"("messageId" ASC);

-- CreateIndex
CREATE INDEX "Opportunity_locationId_idx" ON "Opportunity"("locationId" ASC);

-- CreateIndex
CREATE INDEX "Opportunity_pipelineId_idx" ON "Opportunity"("pipelineId" ASC);

-- CreateIndex
CREATE INDEX "Opportunity_stageId_idx" ON "Opportunity"("stageId" ASC);

-- CreateIndex
CREATE INDEX "Order_contactId_idx" ON "Order"("contactId" ASC);

-- CreateIndex
CREATE INDEX "Order_locationId_idx" ON "Order"("locationId" ASC);

-- CreateIndex
CREATE INDEX "Order_locationId_placedAt_idx" ON "Order"("locationId" ASC, "placedAt" ASC);

-- CreateIndex
CREATE INDEX "Order_locationId_source_externalId_idx" ON "Order"("locationId" ASC, "source" ASC, "externalId" ASC);

-- CreateIndex
CREATE INDEX "Order_locationId_status_idx" ON "Order"("locationId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "Pipeline_locationId_idx" ON "Pipeline"("locationId" ASC);

-- CreateIndex
CREATE INDEX "PipelineStage_pipelineId_idx" ON "PipelineStage"("pipelineId" ASC);

-- CreateIndex
CREATE INDEX "Product_locationId_category_idx" ON "Product"("locationId" ASC, "category" ASC);

-- CreateIndex
CREATE INDEX "Product_locationId_idx" ON "Product"("locationId" ASC);

-- CreateIndex
CREATE INDEX "Product_locationId_source_externalId_idx" ON "Product"("locationId" ASC, "source" ASC, "externalId" ASC);

-- CreateIndex
CREATE INDEX "Product_locationId_supplier_idx" ON "Product"("locationId" ASC, "supplier" ASC);

-- CreateIndex
CREATE INDEX "Product_locationId_warehouse_idx" ON "Product"("locationId" ASC, "warehouse" ASC);

-- CreateIndex
CREATE INDEX "ProductCategory_locationId_idx" ON "ProductCategory"("locationId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_locationId_slug_key" ON "ProductCategory"("locationId" ASC, "slug" ASC);

-- CreateIndex
CREATE INDEX "RenderJob_locationId_createdAt_idx" ON "RenderJob"("locationId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "RenderJob_status_idx" ON "RenderJob"("status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Site_customDomain_key" ON "Site"("customDomain" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Site_locationId_key" ON "Site"("locationId" ASC);

-- CreateIndex
CREATE INDEX "SitePage_siteId_idx" ON "SitePage"("siteId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "SitePage_siteId_slug_key" ON "SitePage"("siteId" ASC, "slug" ASC);

-- CreateIndex
CREATE INDEX "SocialPost_locationId_idx" ON "SocialPost"("locationId" ASC);

-- CreateIndex
CREATE INDEX "SocialPost_status_scheduledAt_idx" ON "SocialPost"("status" ASC, "scheduledAt" ASC);

-- CreateIndex
CREATE INDEX "StageAction_stageId_idx" ON "StageAction"("stageId" ASC);

-- CreateIndex
CREATE INDEX "StorageBooking_locationId_idx" ON "StorageBooking"("locationId" ASC);

-- CreateIndex
CREATE INDEX "StorageBooking_locationId_status_idx" ON "StorageBooking"("locationId" ASC, "status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "StorageBooking_ref_key" ON "StorageBooking"("ref" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "StorageProduct_locationId_code_key" ON "StorageProduct"("locationId" ASC, "code" ASC);

-- CreateIndex
CREATE INDEX "StorageProduct_locationId_idx" ON "StorageProduct"("locationId" ASC);

-- CreateIndex
CREATE INDEX "StorageServiceRequest_locationId_idx" ON "StorageServiceRequest"("locationId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "StorageSettings_locationId_key" ON "StorageSettings"("locationId" ASC);

-- CreateIndex
CREATE INDEX "StorageWaitlist_locationId_idx" ON "StorageWaitlist"("locationId" ASC);

-- CreateIndex
CREATE INDEX "Tag_locationId_idx" ON "Tag"("locationId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Tag_locationId_name_key" ON "Tag"("locationId" ASC, "name" ASC);

-- CreateIndex
CREATE INDEX "Task_contactId_idx" ON "Task"("contactId" ASC);

-- CreateIndex
CREATE INDEX "Task_locationId_completed_idx" ON "Task"("locationId" ASC, "completed" ASC);

-- CreateIndex
CREATE INDEX "Task_locationId_idx" ON "Task"("locationId" ASC);

-- CreateIndex
CREATE INDEX "UsageEvent_locationId_createdAt_idx" ON "UsageEvent"("locationId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "UsageEvent_locationId_kind_idx" ON "UsageEvent"("locationId" ASC, "kind" ASC);

-- CreateIndex
CREATE INDEX "User_agencyId_idx" ON "User"("agencyId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "VoiceAgent_locationId_key" ON "VoiceAgent"("locationId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "VoiceAgent_phoneNumber_key" ON "VoiceAgent"("phoneNumber" ASC);

-- CreateIndex
CREATE INDEX "Workflow_locationId_idx" ON "Workflow"("locationId" ASC);

-- CreateIndex
CREATE INDEX "Workflow_locationId_status_triggerType_idx" ON "Workflow"("locationId" ASC, "status" ASC, "triggerType" ASC);

-- CreateIndex
CREATE INDEX "WorkflowRun_locationId_idx" ON "WorkflowRun"("locationId" ASC);

-- CreateIndex
CREATE INDEX "WorkflowRun_workflowId_idx" ON "WorkflowRun"("workflowId" ASC);

-- CreateIndex
CREATE INDEX "WorkflowRunStep_runId_idx" ON "WorkflowRunStep"("runId" ASC);

-- CreateIndex
CREATE INDEX "WorkflowStep_workflowId_idx" ON "WorkflowStep"("workflowId" ASC);

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "Calendar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Calendar" ADD CONSTRAINT "Calendar_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallLog" ADD CONSTRAINT "CallLog_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectComment" ADD CONSTRAINT "ConnectComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "ConnectMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectComment" ADD CONSTRAINT "ConnectComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "ConnectPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectFriend" ADD CONSTRAINT "ConnectFriend_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "ConnectMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectFriend" ADD CONSTRAINT "ConnectFriend_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "ConnectMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectGroup" ADD CONSTRAINT "ConnectGroup_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "ConnectMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectGroupMember" ADD CONSTRAINT "ConnectGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ConnectGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectGroupMember" ADD CONSTRAINT "ConnectGroupMember_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "ConnectMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectLike" ADD CONSTRAINT "ConnectLike_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "ConnectMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectLike" ADD CONSTRAINT "ConnectLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "ConnectPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectListing" ADD CONSTRAINT "ConnectListing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "ConnectMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectPost" ADD CONSTRAINT "ConnectPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "ConnectMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectPost" ADD CONSTRAINT "ConnectPost_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ConnectGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Connection" ADD CONSTRAINT "Connection_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactTag" ADD CONSTRAINT "ContactTag_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactTag" ADD CONSTRAINT "ContactTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomField" ADD CONSTRAINT "CustomField_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomFieldValue" ADD CONSTRAINT "CustomFieldValue_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomFieldValue" ADD CONSTRAINT "CustomFieldValue_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "CustomField"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryJob" ADD CONSTRAINT "DeliveryJob_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryJob" ADD CONSTRAINT "DeliveryJob_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalBusy" ADD CONSTRAINT "ExternalBusy_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Form" ADD CONSTRAINT "Form_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomesteadBooking" ADD CONSTRAINT "HomesteadBooking_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomesteadBooking" ADD CONSTRAINT "HomesteadBooking_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "HomesteadRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomesteadRoom" ADD CONSTRAINT "HomesteadRoom_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomesteadSettings" ADD CONSTRAINT "HomesteadSettings_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxFolder" ADD CONSTRAINT "InboxFolder_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingItem" ADD CONSTRAINT "ListingItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ListingBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "PipelineStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pipeline" ADD CONSTRAINT "Pipeline_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineStage" ADD CONSTRAINT "PipelineStage_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenderJob" ADD CONSTRAINT "RenderJob_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Site" ADD CONSTRAINT "Site_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitePage" ADD CONSTRAINT "SitePage_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageAction" ADD CONSTRAINT "StageAction_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "PipelineStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorageBooking" ADD CONSTRAINT "StorageBooking_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorageBooking" ADD CONSTRAINT "StorageBooking_productId_fkey" FOREIGN KEY ("productId") REFERENCES "StorageProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorageProduct" ADD CONSTRAINT "StorageProduct_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorageServiceRequest" ADD CONSTRAINT "StorageServiceRequest_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorageSettings" ADD CONSTRAINT "StorageSettings_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorageWaitlist" ADD CONSTRAINT "StorageWaitlist_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceAgent" ADD CONSTRAINT "VoiceAgent_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRunStep" ADD CONSTRAINT "WorkflowRunStep_runId_fkey" FOREIGN KEY ("runId") REFERENCES "WorkflowRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowStep" ADD CONSTRAINT "WorkflowStep_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

