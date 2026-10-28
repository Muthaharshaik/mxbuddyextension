// node_modules/@mendix/extensions-api/dist/index.js
import { getComponentFramework as t } from "@mendix/component-framework";
import { getComponentFramework as l } from "@mendix/component-framework";
import { getModelAccessWithComponentProxy as p } from "@mendix/model-access-sdk";
import { deleteElement as g, getContainer as x } from "@mendix/model-access-sdk";
function a(n) {
  const i = t(n);
  function e(o, s) {
    return p(o, s, n, void 0, { dynamicModelImport: true });
  }
  return {
    app: {
      files: i.getApi("mendix.AppFilesApi"),
      model: {
        domainModels: e(
          "mendix.DomainModelApi",
          "DomainModels$DomainModel"
        ),
        pages: e("mendix.PageApi", "Pages$Page"),
        constants: e(
          "mendix.ConstantApi",
          "Constants$Constant"
        ),
        enumerations: e(
          "mendix.EnumerationApi",
          "Enumerations$Enumeration"
        ),
        snippets: e(
          "mendix.SnippetApi",
          "Pages$Snippet"
        ),
        buildingBlocks: e(
          "mendix.BuildingBlockApi",
          "Pages$BuildingBlock"
        ),
        projects: i.getApi("mendix.ProjectApi"),
        modules: i.getApi("mendix.ModuleApi"),
        moduleSettings: e(
          "mendix.ModuleSettingsApi",
          "Projects$ModuleSettings"
        ),
        microflows: e(
          "mendix.MicroflowModelApi",
          "Microflows$Microflow"
        ),
        customBlobDocuments: i.getApi("mendix.CustomBlobDocumentApi"),
        importMappings: e(
          "mendix.ImportMappingModelApi",
          "ImportMappings$ImportMapping"
        ),
        exportMappings: e(
          "mendix.ExportMappingModelApi",
          "ExportMappings$ExportMapping"
        ),
        jsonStructures: e(
          "mendix.JsonStructureModelApi",
          "JsonStructures$JsonStructure"
        ),
        messageDefinitions: e(
          "mendix.MessageDefinitionModelApi",
          "MessageDefinitions$MessageDefinitionCollection"
        ),
        xmlSchemas: e(
          "mendix.XmlSchemaModelApi",
          "XmlSchemas$XmlSchema"
        ),
        workflows: e(
          "mendix.WorkflowApi",
          "Workflows$Workflow"
        ),
        imageCollections: e(
          "mendix.ImageCollectionApi",
          "Images$ImageCollection"
        ),
        regularExpressions: e(
          "mendix.RegularExpressionApi",
          "RegularExpressions$RegularExpression"
        ),
        moduleSecurity: e(
          "mendix.ModuleSecurityApi",
          "Security$ModuleSecurity"
        ),
        viewEntitySourceDocuments: e(
          "mendix.ViewEntitySourceDocumentApi",
          "DomainModels$ViewEntitySourceDocument"
        ),
        layouts: e("mendix.LayoutApi", "Pages$Layout"),
        pageTemplates: e(
          "mendix.PageTemplateApi",
          "Pages$PageTemplate"
        ),
        customIconCollections: e(
          "mendix.CustomIconCollectionApi",
          "CustomIcons$CustomIconCollection"
        ),
        dataSets: e(
          "mendix.DataSetApi",
          "DataSets$DataSet"
        ),
        documentTemplates: e(
          "mendix.DocumentTemplateApi",
          "DocumentTemplates$DocumentTemplate"
        ),
        menuDocuments: e(
          "mendix.MenuDocumentApi",
          "Menus$MenuDocument"
        ),
        nanoflows: e(
          "mendix.NanoflowApi",
          "Microflows$Nanoflow"
        ),
        rules: e("mendix.RuleApi", "Microflows$Rule"),
        mlMappingDocuments: e(
          "mendix.MLMappingDocumentApi",
          "MLMappings$MLMappingDocument"
        ),
        queues: e("mendix.QueueApi", "Queues$Queue"),
        dataTransformers: e(
          "mendix.DataTransformerApi",
          "DataTransformers$DataTransformer"
        ),
        messageDefinitions2: e(
          "mendix.MessageDefinition2Api",
          "MessageDefinitions$MessageDefinition2"
        ),
        publishedODataServices2: e(
          "mendix.PublishedODataService2Api",
          "ODataPublish$PublishedODataService2"
        ),
        consumedODataServices: e(
          "mendix.ConsumedODataServiceApi",
          "Rest$ConsumedODataService"
        ),
        consumedRestServices: e(
          "mendix.ConsumedRestServiceApi",
          "Rest$ConsumedRestService"
        ),
        publishedRestServices: e(
          "mendix.PublishedRestServiceApi",
          "Rest$PublishedRestService"
        ),
        importedWebServices: e(
          "mendix.ImportedWebServiceApi",
          "WebServices$ImportedWebService"
        ),
        publishedWebServices: e(
          "mendix.PublishedWebServiceApi",
          "WebServices$PublishedWebService"
        ),
        scheduledEvents: e(
          "mendix.ScheduledEventApi",
          "ScheduledEvents$ScheduledEvent"
        ),
        javaActions: e(
          "mendix.JavaActionApi",
          "JavaActions$JavaAction"
        ),
        javaScriptActions: e(
          "mendix.JavaScriptActionApi",
          "JavaScriptActions$JavaScriptAction"
        ),
        authentications: e(
          "mendix.AuthenticationApi",
          "Authentication$Authentication"
        ),
        connectors: e(
          "mendix.ConnectorApi",
          "ConnectorKit$Connector"
        ),
        connectorTypes: e(
          "mendix.ConnectorTypeApi",
          "ConnectorKit$ConnectorType"
        ),
        databaseConnections: e(
          "mendix.DatabaseConnectionApi",
          "DatabaseConnector$DatabaseConnection"
        ),
        excelDataImporterTemplates: e(
          "mendix.ExcelDataImporterTemplateApi",
          "ExcelDataImporter$Template"
        ),
        businessEventServices: e(
          "mendix.BusinessEventServiceApi",
          "BusinessEvents$BusinessEventService"
        ),
        entityChangeDataCaptureServices: e(
          "mendix.EntityChangeDataCaptureServiceApi",
          "ChangeDataCapture$EntityChangeDataCaptureService"
        )
      }
    }
  };
}
function d(n) {
  if (n.runMode !== "ui")
    throw new Error("getStudioProApi can only be used in UI mode, please use getHeadlessStudioProApi instead");
  const i = t(n);
  return {
    app: {
      ...a(n).app,
      projectChanges: i.getApi("mendix.ProjectChangesApi")
    },
    ui: {
      messageBoxes: i.getApi("mendix.MessageBoxApi"),
      tabs: i.getApi("mendix.TabApi"),
      panes: i.getApi("mendix.DockablePaneApi"),
      extensionsMenu: i.getApi("mendix.ExtensionsMenuApi"),
      preferences: i.getApi("mendix.PreferencesApi"),
      dialogs: i.getApi("mendix.DialogApi"),
      notifications: i.getApi("mendix.NotificationApi"),
      editors: i.getApi("mendix.EditorApi"),
      elementSelectors: i.getApi("mendix.ElementSelectorApi"),
      versionControl: i.getApi("mendix.VersionControlApi"),
      appExplorer: i.getApi("mendix.AppExplorerApi"),
      documents: i.getApi("mendix.DocumentEditorApi"),
      messagePassing: i.getApi("mendix.MessagePassingApi"),
      extensionPermissions: i.getApi("mendix.ExtensionPermissionsApi")
    },
    network: {
      httpProxy: i.getApi("mendix.HttpProxyApi")
    },
    runtime: {
      controller: i.getApi("mendix.RuntimeControllerApi"),
      configuration: i.getApi("mendix.RuntimeConfigurationApi")
    }
  };
}

// src/shared/messages.ts
var DEV_TIPS = [
  "Press F4 to synchronize the app directory after adding files outside Studio Pro.",
  "Ctrl+G lets you jump to any document by name.",
  'Select activities, right-click and choose "Extract submicroflow" to split a large microflow.',
  "Retrieve a list once before a loop, then use Find or Filter list operations inside it.",
  "Commit a list once after a loop instead of committing each object inside it.",
  "Use XPath constraints on a Retrieve instead of retrieving everything and filtering afterwards.",
  "Add indexes to attributes you often search or sort on in large tables.",
  "Non-persistable entities are perfect for page helpers \u2014 they never touch the database.",
  "Calculated attributes run on every retrieve. Store the value if it's expensive to compute.",
  'Right-click a document and choose "Find usages" before deleting it.',
  "Use custom error handling on REST calls so a failing service doesn't silently roll back your work.",
  "Give each module role access to only the attributes it really needs.",
  "Prefix sub-microflows with SUB_ so their purpose is clear in the App Explorer.",
  "Keep entities focused \u2014 20+ attributes is often a sign the entity should be split."
];
function getGreeting(date) {
  const day = date.getDay();
  const hour = date.getHours();
  if (hour >= 22 || hour < 5) return "Late-night session \u2014 don't forget to rest.";
  if (day === 1 && hour < 12) return "New week, new features. Let's go!";
  if (day === 5 && hour >= 15) return "Friday afternoon \u2014 a good time to wrap up cleanly.";
  if (day === 0 || day === 6) return "Weekend build? Keep it light.";
  if (hour < 12) return "Good morning! Ready to build?";
  if (hour < 17) return "Good afternoon! Let's keep the momentum going.";
  return "Good evening! Let's get a few things done.";
}
function getContextNudge(date, sessionMs, microflowsChanged) {
  const hour = date.getHours();
  const day = date.getDay();
  const hours = sessionMs / 36e5;
  if (hour >= 22 || hour < 5) return "It's getting late. Commit your work and get some rest.";
  if (hours >= 3) return "Solid work today. Save and take a proper break.";
  if (microflowsChanged >= 5) return `You're on a roll \u2014 ${microflowsChanged} microflows this session.`;
  if (day === 1 && hour < 12 && hours < 1) return "New week, new features. Let's go.";
  if (day === 5 && hour >= 15) return "Friday afternoon \u2014 great time to commit and wrap up.";
  return null;
}
function isTrackableDocument(documentType) {
  return !documentType?.startsWith("Projects$");
}
var DOC_TYPE_LABELS = {
  "Microflows$Microflow": "Microflows",
  "Microflows$Nanoflow": "Nanoflows",
  "Microflows$Rule": "Rules",
  "Pages$Page": "Pages",
  "Pages$Snippet": "Snippets",
  "Pages$Layout": "Layouts",
  "DomainModels$DomainModel": "Domain models",
  "Enumerations$Enumeration": "Enumerations",
  "Constants$Constant": "Constants",
  "JavaActions$JavaAction": "Java actions",
  "JavaScriptActions$JavaScriptAction": "JavaScript actions",
  "Workflows$Workflow": "Workflows"
};
function docTypeLabel(documentType) {
  return documentType && DOC_TYPE_LABELS[documentType] || "Other";
}
var COMMIT_NUDGE_EVERY = 15;

export {
  d,
  DEV_TIPS,
  getGreeting,
  getContextNudge,
  isTrackableDocument,
  docTypeLabel,
  COMMIT_NUDGE_EVERY
};
//# sourceMappingURL=chunk-GN5D73MI.js.map
