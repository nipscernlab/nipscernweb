`timescale 1ns/1ps

module tb_sequencia_quadrados;
    reg clk = 1'b0;
    reg rst = 1'b1;
    wire signed [31:0] out;
    wire [0:0] out_en;
    wire cheguei;

    integer ciclos = 0;
    integer indice = 0;
    integer terminou = 0;
    integer esperado [0:3];

    sequencia_quadrados dut (
        .clk(clk),
        .rst(rst),
        .out(out),
        .out_en(out_en),
        .cheguei(cheguei)
    );

    always #5 clk = ~clk;

    always @(posedge clk) begin
        if (!rst && (out_en == 1)) begin
            if (indice > 3) begin
                $display("ERRO: o processador produziu saidas extras.");
                $fatal(1);
            end

            if ($signed(out) !== esperado[indice]) begin
                $display(
                    "ERRO: indice=%0d esperado=%0d obtido=%0d",
                    indice, esperado[indice], $signed(out)
                );
                $fatal(1);
            end

            indice = indice + 1;
        end

        if (cheguei === 1'b1)
            terminou = 1;
    end

    initial begin
        esperado[0] = 0;
        esperado[1] = 1;
        esperado[2] = 4;
        esperado[3] = 9;

        $dumpfile("tb_sequencia_quadrados.vcd");
        $dumpvars(0, tb_sequencia_quadrados);

        repeat (2) @(posedge clk);
        @(negedge clk);
        rst = 1'b0;

        while (!terminou && (ciclos < 400)) begin
            @(posedge clk);
            ciclos = ciclos + 1;
        end

        repeat (2) @(posedge clk);
        #1;

        if (indice !== 4) begin
            $display("ERRO: esperadas=4 saidas_recebidas=%0d", indice);
            $fatal(1);
        end

        if (!terminou) begin
            $display("ERRO: tempo limite antes de #TOAQUI.");
            $fatal(1);
        end

        $display("SUCESSO: sequencia 0, 1, 4, 9 validada.");
        $finish;
    end
endmodule
