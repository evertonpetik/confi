/**
 * agentTools.test.ts
 *
 * Testes básicos para verificar que as novas tools estão implementadas corretamente
 * Rode com: npm test -- agentTools.test.ts
 */

import { AGENT_TOOLS } from "./agentTools";

describe("agentTools", () => {
  describe("AGENT_TOOLS definition", () => {
    it("deve ter pelo menos 7 tools definidas", () => {
      expect(AGENT_TOOLS.length).toBeGreaterThanOrEqual(7);
    });

    it("deve incluir as 5 tools originais", () => {
      const toolNames = AGENT_TOOLS.map((t) => t.name);
      expect(toolNames).toContain("consultar_lote");
      expect(toolNames).toContain("consultar_dashboard");
      expect(toolNames).toContain("registrar_leitura_cocho");
      expect(toolNames).toContain("consultar_estoque_insumo");
      expect(toolNames).toContain("consultar_historico_gmd");
    });

    it("deve incluir as 2 novas tools de análise", () => {
      const toolNames = AGENT_TOOLS.map((t) => t.name);
      expect(toolNames).toContain("analisar_saude_rebanho");
      expect(toolNames).toContain("alertas_operacionais");
    });

    it("cada tool deve ter description", () => {
      AGENT_TOOLS.forEach((tool) => {
        expect(tool.description).toBeDefined();
        expect(tool.description.length).toBeGreaterThan(10);
      });
    });

    it("cada tool deve ter input_schema bem formado", () => {
      AGENT_TOOLS.forEach((tool) => {
        expect(tool.input_schema).toBeDefined();
        expect(tool.input_schema.type).toBe("object");
      });
    });

    it("tools que não precisam input devem ter properties vazio", () => {
      const dashboardTool = AGENT_TOOLS.find((t) => t.name === "consultar_dashboard");
      expect(dashboardTool?.input_schema.properties).toEqual({});

      const saudeTool = AGENT_TOOLS.find((t) => t.name === "analisar_saude_rebanho");
      expect(saudeTool?.input_schema.properties).toEqual({});

      const alertasTool = AGENT_TOOLS.find((t) => t.name === "alertas_operacionais");
      expect(alertasTool?.input_schema.properties).toEqual({});
    });

    it("tools que recebem input devem ter required array", () => {
      const consultarLoteTool = AGENT_TOOLS.find((t) => t.name === "consultar_lote");
      expect(consultarLoteTool?.input_schema.required).toContain("numero");

      const leituraTool = AGENT_TOOLS.find((t) => t.name === "registrar_leitura_cocho");
      expect(leituraTool?.input_schema.required).toContain("piqueteNome");
      expect(leituraTool?.input_schema.required).toContain("nota");
    });
  });

  describe("Tool schemas", () => {
    it("consultar_lote deve aceitar numero", () => {
      const tool = AGENT_TOOLS.find((t) => t.name === "consultar_lote");
      const schema = tool?.input_schema;
      expect(schema?.properties?.numero?.type).toBe("number");
    });

    it("registrar_leitura_cocho deve ter piqueteNome (string) e nota (number)", () => {
      const tool = AGENT_TOOLS.find((t) => t.name === "registrar_leitura_cocho");
      const schema = tool?.input_schema;
      expect(schema?.properties?.piqueteNome?.type).toBe("string");
      expect(schema?.properties?.nota?.type).toBe("number");
    });

    it("consultar_historico_gmd deve ter numeroLote (required) e dias (optional)", () => {
      const tool = AGENT_TOOLS.find((t) => t.name === "consultar_historico_gmd");
      const schema = tool?.input_schema;
      expect(schema?.required).toContain("numeroLote");
      expect(schema?.properties?.numeroLote?.type).toBe("number");
      expect(schema?.properties?.dias?.type).toBe("number");
    });

    it("consultar_estoque_insumo deve ter nome (string, required)", () => {
      const tool = AGENT_TOOLS.find((t) => t.name === "consultar_estoque_insumo");
      const schema = tool?.input_schema;
      expect(schema?.required).toContain("nome");
      expect(schema?.properties?.nome?.type).toBe("string");
    });
  });

  describe("Tool naming", () => {
    it("todos os nomes devem ser snake_case", () => {
      AGENT_TOOLS.forEach((tool) => {
        expect(tool.name).toMatch(/^[a-z_]+$/);
        expect(tool.name).not.toMatch(/_$/); // sem trailing underscore
      });
    });

    it("não deve haver tools duplicadas", () => {
      const names = AGENT_TOOLS.map((t) => t.name);
      const unique = new Set(names);
      expect(unique.size).toBe(names.length);
    });
  });
});
